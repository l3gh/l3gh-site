import io, sqlite3, hashlib, base64, tarfile
from urllib.parse import urlparse,parse_qs
from unittest.mock import Mock
import pytest
from PIL import Image
from app import create_app
from backup import backup
@pytest.fixture
def env(tmp_path):
    app=create_app(dict(TESTING=True,DATA=str(tmp_path/'data'),SESSION_SECRET='s'*40,CLIENT_ID='client',CLIENT_SECRET='secret',OWNER_IDS='123'))
    c=app.test_client(); return app,c,tmp_path

def auth(app,c):
    c.get('/admin/login',base_url='https://media.l3gh.com')
    with sqlite3.connect(app.config['DATA']+'/gallery.sqlite') as db: db.execute("UPDATE sessions SET uid='123'")

def post(app,c,url,data):
    with sqlite3.connect(app.config['DATA']+'/gallery.sqlite') as db: csrf=db.execute('SELECT csrf FROM sessions').fetchone()[0]
    return c.post(url,data={'csrf':csrf,**data},base_url='https://media.l3gh.com',headers={'Origin':'https://media.l3gh.com'})
def photo():
    b=io.BytesIO(); im=Image.new('RGB',(60,30)); ex=Image.Exif(); ex[274]=6; ex[270]='private location'; im.save(b,'JPEG',exif=ex); b.seek(0); return b

def test_denial(env):
    a,c,_=env
    assert c.get('/admin').status_code==302
    a.config['OWNER_IDS']=''; assert c.get('/admin/login').status_code==503
    assert c.get('/health').json=={'status':'ok'}
def test_oauth(env,monkeypatch):
    a,c,_=env
    r=c.get('/admin/login',base_url='https://media.l3gh.com'); q=parse_qs(urlparse(r.location).query)
    with sqlite3.connect(a.config['DATA']+'/gallery.sqlite') as db: verifier=db.execute('SELECT verifier FROM sessions').fetchone()[0]
    assert q['redirect_uri']==['https://media.l3gh.com/auth/github/callback']
    assert 'client_secret' not in q
    assert q['code_challenge']==[base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')]
    p=Mock(return_value=Mock(json=lambda:{'access_token':'token'})); get=Mock(return_value=Mock(json=lambda:{'id':999,'login':'l3gh'}))
    monkeypatch.setattr('app.requests.post',p); monkeypatch.setattr('app.requests.get',get)
    url='/auth/github/callback?code=code&state='+q['state'][0]
    assert c.get(url,base_url='https://media.l3gh.com').status_code==403
    assert p.call_args.kwargs['data']['code_verifier']==verifier
    assert c.get(url,base_url='https://media.l3gh.com').status_code==403
    assert p.call_count==1
    c.get('/admin/login',base_url='https://media.l3gh.com')
    assert c.get('/auth/github/callback?state=wrong&code=x',base_url='https://media.l3gh.com').status_code==403
    get.return_value=Mock(json=lambda:{'id':123})
    r=c.get('/admin/login',base_url='https://media.l3gh.com'); state=parse_qs(urlparse(r.location).query)['state'][0]
    assert c.get('/auth/github/callback?code=x&state='+state,base_url='https://media.l3gh.com').status_code==302
    assert c.get('/admin',base_url='https://media.l3gh.com').status_code==200

def test_lifecycle(env):
    a,c,tmp=env; auth(a,c)
    assert c.post('/admin/upload',base_url='https://media.l3gh.com').status_code==403
    assert post(a,c,'/admin/upload',{'file':(io.BytesIO(b'<svg/>'),'a.svg')}).status_code==400
    assert post(a,c,'/admin/upload',{'file':(photo(),'a.jpg')}).status_code==302
    with sqlite3.connect(a.config['DATA']+'/gallery.sqlite') as db: ident=db.execute('SELECT id FROM items').fetchone()[0]
    path='/media/'+ident+'-display.webp'
    assert c.get(path).status_code==404; assert c.get('/api/gallery').json=={'items':[]}
    with Image.open(tmp/'data'/'derivatives'/(ident+'-display.webp')) as im:
        assert im.size==(30,60); assert not im.getexif(); assert 'exif' not in im.info
    assert post(a,c,'/admin/item/'+ident,dict(title='<x>',caption='hi',alt='alt',position='5',published='yes')).status_code==302
    assert c.get(path).status_code==200
    item=c.get('/api/gallery').json['items'][0]; assert set(item)==set('id title caption alt image_url thumbnail_url width height'.split())
    assert b'&lt;x&gt;' in c.get('/admin',base_url='https://media.l3gh.com').data
    post(a,c,'/admin/upload',{'file':(photo(),'b.jpg')})
    with sqlite3.connect(a.config['DATA']+'/gallery.sqlite') as db: second=db.execute('SELECT id FROM items WHERE id!=?',(ident,)).fetchone()[0]
    post(a,c,'/admin/item/'+second,dict(position='-1',published='yes'))
    assert c.get('/api/gallery').json['items'][0]['id']==second
    archive=backup(tmp/'data',tmp/'backups')
    with tarfile.open(archive) as t: t.extractall(tmp/'restore',filter='data')
    with sqlite3.connect(tmp/'restore'/'gallery.sqlite') as db: assert db.execute('SELECT count(*) FROM items').fetchone()[0]==2
    assert (tmp/'restore'/'originals'/ident).exists()
    post(a,c,'/admin/item/'+ident,dict(position='0'))
    assert c.get(path).status_code==404
    post(a,c,'/admin/item/'+ident,dict(action='delete'))
    assert not (tmp/'data'/'originals'/ident).exists()
    for path in ('/media/../originals/'+second,'/media/'+second,'/media/%2e%2e%2foriginals/a'): assert c.get(path).status_code==404

def test_db_failure_cleanup(env):
    a,c,tmp=env; auth(a,c)
    with sqlite3.connect(a.config['DATA']+'/gallery.sqlite') as db: db.execute("CREATE TRIGGER fail BEFORE INSERT ON items BEGIN SELECT RAISE(FAIL,'test'); END")
    with pytest.raises(sqlite3.IntegrityError): post(a,c,'/admin/upload',{'file':(photo(),'a.jpg')})
    assert list((tmp/'data'/'originals').iterdir())==[]; assert list((tmp/'data'/'derivatives').iterdir())==[]

def test_quota(env):
    a,c,_=env; auth(a,c); a.config['QUOTA_BYTES']=1
    assert post(a,c,'/admin/upload',{'file':(photo(),'a.jpg')}).status_code==507

def test_pixel_and_file_failures(env,monkeypatch):
    a,c,tmp=env; auth(a,c)
    monkeypatch.setattr('app.Image.MAX_IMAGE_PIXELS',10)
    assert post(a,c,'/admin/upload',{'file':(photo(),'huge.jpg')}).status_code==400
    assert not list((tmp/'data'/'originals').iterdir())
    monkeypatch.setattr('app.Image.MAX_IMAGE_PIXELS',40_000_000)
    b=photo()
    monkeypatch.setattr('app.Image.Image.save',Mock(side_effect=OSError('disk full')))
    assert post(a,c,'/admin/upload',{'file':(b,'bad.jpg')}).status_code==400
    assert not list((tmp/'data'/'derivatives').iterdir())
    assert not list((tmp/'data'/'originals').iterdir())

def owner_login(app, client, monkeypatch):
    """Isolated mocked OAuth only; never creates a production session."""
    monkeypatch.setattr('app.requests.post', Mock(return_value=Mock(json=lambda: {'access_token': 'test-token'})))
    monkeypatch.setattr('app.requests.get', Mock(return_value=Mock(json=lambda: {'id': 228398289})))
    app.config['OWNER_IDS'] = '228398289'
    response = client.get('/admin/login', base_url='https://media.l3gh.com')
    state = parse_qs(urlparse(response.location).query)['state'][0]
    return client.get('/auth/github/callback', query_string={'code': 'test-code', 'state': state}, base_url='https://media.l3gh.com')


def test_admin_route_forms_and_session(env, monkeypatch):
    a, c, _ = env
    assert owner_login(a, c, monkeypatch).location == '/admin'
    for path in ('/admin', '/admin/'):
        response = c.get(path, base_url='https://media.l3gh.com')
        assert response.status_code == 200
        assert response.headers['Cache-Control'] == 'no-store'
        assert "form-action 'self'" in response.headers['Content-Security-Policy']
        assert b'action="/admin/upload"' in response.data
        assert b'enctype="multipart/form-data"' in response.data
        assert b'action="/admin/logout"' in response.data
        assert b'<script' not in response.data
    assert c.post('/admin/upload', base_url='https://media.l3gh.com').status_code == 403
    assert post(a, c, '/admin/logout', {}).status_code == 302
    assert c.get('/admin', base_url='https://media.l3gh.com').location == '/admin/login'
    assert c.post('/admin/upload', base_url='https://media.l3gh.com').status_code == 401


def test_oauth_cookie_and_missing_expired_state(env, monkeypatch):
    a, c, _ = env
    r = c.get('/admin/login', base_url='https://media.l3gh.com')
    cookie = r.headers['Set-Cookie']
    assert all(value in cookie for value in ('__Host-gallery=', 'Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/'))
    assert 'Domain=' not in cookie
    state = parse_qs(urlparse(r.location).query)['state'][0]
    exchange = Mock()
    monkeypatch.setattr('app.requests.post', exchange)
    with sqlite3.connect(a.config['DATA']+'/gallery.sqlite') as db:
        db.execute('UPDATE sessions SET oauth_until=0')
    assert c.get('/auth/github/callback', query_string={'code': 'test', 'state': state}, base_url='https://media.l3gh.com').status_code == 403
    exchange.assert_not_called()
    anonymous = a.test_client()
    assert anonymous.get('/auth/github/callback', base_url='https://media.l3gh.com').status_code == 403

@pytest.mark.parametrize('case,reason,status', [
    ('wrong_state','state_mismatch',403), ('expired_state','state_expired',403),
    ('expired_session','session_missing_or_expired',403), ('replaced_session','state_mismatch',403),
    ('missing_code','code_missing',403), ('declined','authorization_declined',403),
    ('token_error','bad_verification_code',502), ('pkce_error','token_response_invalid',502),
    ('string_id','identity_shape_invalid',502), ('boolean_id','identity_shape_invalid',502),
    ('wrong_owner','owner_rejected',403), ('list_identity','identity_shape_invalid',502),
])
def test_callback_diagnostics(env, monkeypatch, caplog, case, reason, status):
    a,c,_=env
    r=c.get('/admin/login',base_url='https://media.l3gh.com')
    state=parse_qs(urlparse(r.location).query)['state'][0]
    token={'access_token':'PRIVATE-TOKEN'}
    identity={'id':123,'login':'ignored','node_id':'ignored'}
    if case=='token_error': token={'error':'bad_verification_code','error_description':'PRIVATE-DESCRIPTION'}
    if case=='pkce_error': token={'error':'PRIVATE-UNKNOWN-ERROR'}
    if case=='string_id': identity={'id':'123'}
    if case=='boolean_id': identity={'id':True}
    if case=='wrong_owner': identity={'id':999,'login':'owner-name-is-not-authorization'}
    if case=='list_identity': identity=[]
    exchange=Mock(return_value=Mock(json=lambda:token))
    monkeypatch.setattr('app.requests.post',exchange)
    monkeypatch.setattr('app.requests.get',Mock(return_value=Mock(json=lambda:identity)))
    if case in ('expired_state','expired_session'):
        with sqlite3.connect(a.config['DATA']+'/gallery.sqlite') as db:
            db.execute('UPDATE sessions SET '+('expires' if case=='expired_session' else 'oauth_until')+'=1')
    if case=='replaced_session': c.get('/admin/login',base_url='https://media.l3gh.com')
    args={'code':'PRIVATE-CODE','state':'wrong' if case=='wrong_state' else state}
    if case in ('missing_code','declined'): args.pop('code')
    if case=='declined': args['error']='access_denied'
    r=c.get('/auth/github/callback',query_string=args,base_url='https://media.l3gh.com',headers={'Referer':'https://github.com/','Origin':'null'})
    assert r.status_code==status
    assert reason.encode() in r.data
    assert r.headers['Referrer-Policy']=='no-referrer'
    assert reason in caplog.text
    for private in ('PRIVATE-',state,'https://github.com/','owner-name-is-not-authorization','?code='):
        assert private not in caplog.text
    if case in ('wrong_state','expired_state','expired_session','replaced_session','missing_code','declined'): exchange.assert_not_called()


def test_browser_forms_origin_and_head(env, monkeypatch, caplog):
    a,c,_=env
    assert owner_login(a,c,monkeypatch).status_code==302
    # SQLite TEXT affinity converts the validated numeric GitHub ID to a string.
    with sqlite3.connect(a.config['DATA']+'/gallery.sqlite') as db:
        assert db.execute('SELECT typeof(uid) FROM sessions').fetchone()[0]=='text'
    for method in ('get','head'):
        r=getattr(c,method)('/admin/',base_url='https://media.l3gh.com',headers={'Origin':'null'})
        assert r.status_code==200
        assert r.headers['Referrer-Policy']=='same-origin'
    with sqlite3.connect(a.config['DATA']+'/gallery.sqlite') as db: csrf=db.execute('SELECT csrf FROM sessions').fetchone()[0]
    for origin in (None,'null','https://evil.example'):
        headers={} if origin is None else {'Origin':origin}
        r=c.post('/admin/logout',data={'csrf':csrf},headers=headers,base_url='https://media.l3gh.com')
        assert r.status_code==403 and b'origin_rejected' in r.data
    r=c.post('/admin/logout',data={'csrf':'wrong'},headers={'Origin':'https://media.l3gh.com'},base_url='https://media.l3gh.com')
    assert r.status_code==403 and b'csrf_rejected' in r.data
    assert post(a,c,'/admin/upload',{'file':(photo(),'test.jpg')}).status_code==302
    assert post(a,c,'/admin/logout',{}).status_code==302
