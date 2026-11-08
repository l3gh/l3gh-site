import json
import base64, hashlib, os, secrets, shutil, sqlite3, time, uuid, warnings, fcntl
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlencode, urlparse
import requests
from flask import Flask, request, g, abort, redirect, render_template, jsonify, send_file
from PIL import Image, ImageOps, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 40_000_000
warnings.simplefilter('error', Image.DecompressionBombWarning)
SCHEMA = '''
CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,title TEXT NOT NULL DEFAULT '',caption TEXT NOT NULL DEFAULT '',alt TEXT NOT NULL DEFAULT '',position INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 0,width INTEGER NOT NULL,height INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,uid TEXT,csrf TEXT NOT NULL,state TEXT,verifier TEXT,oauth_until INTEGER,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,start INTEGER,n INTEGER);
'''

def create_app(config=None):
    app = Flask(__name__)
    app.config.update(DATA=os.environ.get('DATA','/var/lib/l3gh-media'), PUBLIC_ORIGIN=os.environ.get('PUBLIC_ORIGIN','https://media.l3gh.com'), CLIENT_ID=os.environ.get('GITHUB_CLIENT_ID',''), CLIENT_SECRET=os.environ.get('GITHUB_CLIENT_SECRET',''), OWNER_IDS=os.environ.get('GITHUB_OWNER_IDS',''), SESSION_SECRET=os.environ.get('SESSION_SECRET',''), MAX_CONTENT_LENGTH=21*1024*1024, MAX_FORM_MEMORY_SIZE=65536, MAX_FORM_PARTS=16, QUOTA_BYTES=1024**3, HEADROOM_BYTES=1024**3)
    if config: app.config.update(config)
    root = Path(app.config['DATA']); root.mkdir(parents=True,exist_ok=True)
    for d in ('originals','derivatives'): (root/d).mkdir(exist_ok=True)
    def db():
        c=sqlite3.connect(root/'gallery.sqlite',timeout=15); c.row_factory=sqlite3.Row; return c
    with db() as c: c.executescript(SCHEMA)
    @contextmanager
    def lock():
        with (root/'media.lock').open('a') as f:
            fcntl.flock(f,fcntl.LOCK_EX)
            yield
    def diagnostic(operation, reason, status):
        # Route templates exclude query strings and user-provided path identifiers.
        app.logger.warning(json.dumps(dict(path=request.url_rule.rule if request.url_rule else '/admin', operation=operation, reason=reason, status=status)))
    def deny(operation, reason, message, status=403):
        diagnostic(operation, reason, status)
        return message + ' [reason: ' + reason + ']. Start again at /admin/login.', status
    def owners(): return {x.strip() for x in app.config['OWNER_IDS'].split(',') if x.strip().isdigit() and int(x.strip())>0}
    def configured():
        u=urlparse(app.config['PUBLIC_ORIGIN'])
        return bool(owners() and app.config['CLIENT_ID'] and app.config['CLIENT_SECRET'] and len(app.config['SESSION_SECRET'])>=32 and u.scheme=='https' and u.netloc and not u.path and not u.query and not u.fragment and not u.username)
    def sid_hash(s): return hashlib.sha256((app.config['SESSION_SECRET']+s).encode()).hexdigest()
    def new_session(uid=None):
        raw=secrets.token_urlsafe(32); key=sid_hash(raw); csrf=secrets.token_urlsafe(32)
        with db() as c:
            c.execute('DELETE FROM sessions WHERE expires<?',(int(time.time()),))
            if g.get('session'): c.execute('DELETE FROM sessions WHERE sid=?',(g.session['sid'],))
            c.execute('INSERT INTO sessions(sid,uid,csrf,expires) VALUES(?,?,?,?)',(key,uid,csrf,int(time.time())+28800))
        g.cookie=raw
        with db() as c: g.session=c.execute('SELECT * FROM sessions WHERE sid=?',(key,)).fetchone()
    def rate(name, maximum, window):
        # Peer address only: never trust client forwarded headers.
        key=name+':'+request.remote_addr; now=int(time.time())
        with db() as c:
            c.execute('BEGIN IMMEDIATE'); c.execute('DELETE FROM limits WHERE start<?',(now-3600,))
            r=c.execute('SELECT * FROM limits WHERE key=?',(key,)).fetchone()
            n=1 if not r or r['start']<=now-window else r['n']+1
            start=now if not r or r['start']<=now-window else r['start']
            c.execute('INSERT OR REPLACE INTO limits VALUES(?,?,?)',(key,start,n))
        if n>maximum: abort(429)
    @app.before_request
    def security():
        g.cookie=None
        with db() as c: g.session=c.execute('SELECT * FROM sessions WHERE sid=? AND expires>?',(sid_hash(request.cookies.get('__Host-gallery','')),int(time.time()))).fetchone()
        if request.path.startswith('/admin') or request.path == '/auth/github/callback':
            if not configured(): return 'Gallery setup unavailable',503
            if request.path not in ('/admin/login','/auth/github/callback'):
                if not g.session or g.session['uid'] not in owners():
                    if request.method == 'GET': return redirect('/admin/login')
                    abort(401)
                if request.method not in ('GET','HEAD','OPTIONS'):
                    if request.headers.get('Origin')!=app.config['PUBLIC_ORIGIN']: return deny('mutation', 'origin_rejected', 'The form origin could not be verified. Reload the admin page and submit again')
                    if not secrets.compare_digest(request.form.get('csrf',''),g.session['csrf']): return deny('mutation', 'csrf_rejected', 'The form has expired or could not be verified. Reload the admin page')
    @app.after_request
    def headers(r):
        r.headers.update({'Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':('same-origin' if request.path.startswith('/admin') else 'no-referrer'),'X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'})
        if request.path.startswith('/admin') or request.path == '/auth/github/callback': r.headers['Cache-Control']='no-store'
        if request.path=='/api/gallery' or request.path.startswith('/media/'):
            r.headers['Cache-Control']='public, max-age=0, must-revalidate'
            if request.headers.get('Origin') in ('https://l3gh.com','https://www.l3gh.com'):
                r.headers['Access-Control-Allow-Origin']=request.headers['Origin']
            r.headers['Vary']='Origin'
        if g.get('cookie'): r.set_cookie('__Host-gallery',g.cookie,secure=True,httponly=True,samesite='Lax',max_age=28800,path='/')
        return r
    @app.errorhandler(500)
    def failed(e): return 'Operation unavailable',500
    @app.get('/health')
    def health():
        with db() as c: c.execute('SELECT 1').fetchone()
        return jsonify(status='ok')
    @app.get('/admin/login')
    def login():
        rate('login',10,600); new_session()
        state=secrets.token_urlsafe(32); verifier=secrets.token_urlsafe(48)
        with db() as c: c.execute('UPDATE sessions SET state=?,verifier=?,oauth_until=? WHERE sid=?',(state,verifier,int(time.time())+600,g.session['sid']))
        challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
        return redirect('https://github.com/login/oauth/authorize?'+urlencode(dict(client_id=app.config['CLIENT_ID'],redirect_uri=app.config['PUBLIC_ORIGIN']+'/auth/github/callback',scope='',state=state,code_challenge=challenge,code_challenge_method='S256')))
    @app.get('/auth/github/callback')
    def callback():
        s=g.session
        if not s: return deny('callback', 'session_missing_or_expired', 'The sign-in cookie is missing or expired. Use the same browser with cookies enabled')
        with db() as c:
            c.execute('BEGIN IMMEDIATE')
            valid=c.execute('SELECT * FROM sessions WHERE sid=? AND state IS NOT NULL',(s['sid'],)).fetchone()
            c.execute('UPDATE sessions SET state=NULL,verifier=NULL,oauth_until=NULL WHERE sid=?',(s['sid'],))
        if not valid: return deny('callback', 'state_consumed', 'This sign-in link has already been used or replaced by another sign-in')
        if not valid['oauth_until'] or valid['oauth_until']<time.time(): return deny('callback', 'state_expired', 'The ten-minute sign-in window has expired')
        if not secrets.compare_digest(valid['state'],request.args.get('state','')): return deny('callback', 'state_mismatch', 'This sign-in does not match the current browser session. Avoid concurrent sign-in tabs')
        if request.args.get('error'): return deny('callback', 'authorization_declined', 'GitHub authorization was not completed')
        if not request.args.get('code'): return deny('callback', 'code_missing', 'GitHub did not return a sign-in code')
        try:
            r=requests.post('https://github.com/login/oauth/access_token',data=dict(client_id=app.config['CLIENT_ID'],client_secret=app.config['CLIENT_SECRET'],code=request.args['code'],redirect_uri=app.config['PUBLIC_ORIGIN']+'/auth/github/callback',code_verifier=valid['verifier']),headers={'Accept':'application/json'},timeout=(5,15),allow_redirects=False)
            r.raise_for_status(); payload=r.json()
            token=payload.get('access_token') if isinstance(payload,dict) else None
            if not isinstance(token,str) or not token:
                reason = payload.get('error') if isinstance(payload,dict) else None
                reason = reason if reason in ('bad_verification_code','incorrect_client_credentials','redirect_uri_mismatch') else 'token_response_invalid'
                return deny('token_exchange', reason, 'GitHub could not complete the secure code exchange', 502)
            r=requests.get('https://api.github.com/user',headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'},timeout=(5,15),allow_redirects=False)
            r.raise_for_status(); payload=r.json(); uid=payload.get('id') if isinstance(payload,dict) else None; del token
        except (requests.RequestException,ValueError,TypeError): return deny('github_request', 'upstream_unavailable', 'GitHub identity service is unavailable', 502)
        if type(uid) is not int: return deny('identity', 'identity_shape_invalid', 'GitHub returned an unsupported identity response', 502)
        if str(uid) not in owners(): return deny('identity', 'owner_rejected', 'This GitHub account is not authorized for this gallery')
        new_session(str(uid)); diagnostic('callback', 'authenticated', 302); return redirect('/admin')
    @app.get('/admin', strict_slashes=False)
    def admin():
        with db() as c: items=c.execute('SELECT * FROM items ORDER BY position,id').fetchall()
        return render_template('admin.html',items=items,csrf=g.session['csrf'])
    @app.post('/admin/logout')
    def logout():
        with db() as c: c.execute('DELETE FROM sessions WHERE sid=?',(g.session['sid'],))
        return redirect('/admin/login')
    @app.post('/admin/upload')
    def upload():
        rate('upload',20,3600)
        f=request.files.get('file')
        if not f: abort(400)
        ident=uuid.uuid4().hex; original=root/'originals'/ident
        paths=[original,root/'derivatives'/f'{ident}-display.webp',root/'derivatives'/f'{ident}-thumb.webp']
        with lock():
            used=sum(p.stat().st_size for d in ('originals','derivatives') for p in (root/d).iterdir() if p.is_file())
            if used+64*1024**2>app.config['QUOTA_BYTES'] or shutil.disk_usage(root).free<app.config['HEADROOM_BYTES']+64*1024**2: return 'Storage unavailable',507
            try:
                f.save(original)
                if original.stat().st_size>20*1024**2: abort(413)
                with Image.open(original) as im:
                    if im.format not in ('JPEG','PNG','WEBP') or im.width*im.height>40_000_000 or getattr(im,'n_frames',1)!=1: abort(400)
                    im.verify()
                with Image.open(original) as im:
                    im=ImageOps.exif_transpose(im); im.thumbnail((2560,2560)); clean=im.convert('RGBA' if 'A' in im.getbands() else 'RGB'); clean.info.clear()
                    width,height=clean.size; clean.save(paths[1],'WEBP',quality=85,method=4)
                    clean.thumbnail((480,480)); clean.save(paths[2],'WEBP',quality=80,method=4)
                with db() as c: c.execute('INSERT INTO items(id,width,height) VALUES(?,?,?)',(ident,width,height))
            except BaseException as e:
                for p in paths: p.unlink(missing_ok=True)
                if isinstance(e,(UnidentifiedImageError,Image.DecompressionBombError,Image.DecompressionBombWarning,OSError,ValueError)): abort(400)
                raise
        return redirect('/admin')
    @app.post('/admin/item/<ident>')
    def edit(ident):
        with lock(), db() as c:
            if not c.execute('SELECT 1 FROM items WHERE id=?',(ident,)).fetchone(): abort(404)
            if request.form.get('action')=='delete':
                c.execute('DELETE FROM items WHERE id=?',(ident,)); c.commit()
                for p in [root/'originals'/ident,root/'derivatives'/f'{ident}-display.webp',root/'derivatives'/f'{ident}-thumb.webp']: p.unlink(missing_ok=True)
            else:
                try: position=int(request.form.get('position','0'))
                except ValueError: abort(400)
                if abs(position)>1_000_000: abort(400)
                values=[request.form.get(k,'') for k in ('title','caption','alt')]
                if any(len(v)>4000 for v in values): abort(400)
                c.execute('UPDATE items SET title=?,caption=?,alt=?,position=?,published=? WHERE id=?',(*values,position,int(request.form.get('published')=='yes'),ident))
        return redirect('/admin')
    @app.get('/api/gallery')
    def gallery():
        with db() as c: rows=c.execute('SELECT * FROM items WHERE published=1 ORDER BY position,id').fetchall()
        return jsonify(items=[{**{k:r[k] for k in ('id','title','caption','alt','width','height')},'image_url':f"/media/{r['id']}-display.webp",'thumbnail_url':f"/media/{r['id']}-thumb.webp"} for r in rows])
    @app.get('/media/<name>')
    def media(name):
        import re
        m=re.fullmatch(r'([a-f0-9]{32})-(display|thumb)\.webp',name)
        if not m: abort(404)
        with db() as c: item=c.execute('SELECT 1 FROM items WHERE id=? AND published=1',(m[1],)).fetchone()
        if not item: abort(404)
        return send_file(root/'derivatives'/name,mimetype='image/webp',conditional=True)
    return app
