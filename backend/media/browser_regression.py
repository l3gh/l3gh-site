"""Optional Chromium regression: pip install playwright; playwright install chromium.
Uses intercepted HTTPS requests, temporary data and mocked GitHub; no live sessions.
Run with Python in an environment containing requirements.lock and playwright.
"""
import io
import sqlite3
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from unittest.mock import Mock, patch
from PIL import Image
from playwright.sync_api import sync_playwright
from app import create_app


def verify(policy, expected):
    with tempfile.TemporaryDirectory() as directory:
        app=create_app(dict(TESTING=True, DATA=directory, SESSION_SECRET='s'*40,
                            OWNER_IDS='228398289', CLIENT_ID='test', CLIENT_SECRET='test'))
        # Override only for reproducing the previous response policy.
        def old_policy(response):
            if policy and urlparse(response.location or '').path != '/auth/github/callback':
                response.headers['Referrer-Policy']=policy
            return response
        app.after_request_funcs[None].insert(0,old_policy)
        client=app.test_client()
        submissions=[]
        def dispatch(route):
            req=route.request
            headers=req.all_headers()
            if req.method=='POST':
                submissions.append(dict(origin=headers.get('origin'),cookie='__Host-gallery=' in headers.get('cookie',''),multipart=headers.get('content-type','').startswith('multipart/form-data; boundary=')))
            r=client.open(req.url,method=req.method,headers=headers,data=req.post_data_buffer)
            if r.status_code==302 and r.location=='/admin':
                r=client.get('https://media.l3gh.com/admin',headers=headers)
            route.fulfill(status=r.status_code,headers=dict(r.headers),body=r.data)
        with patch('app.requests.post',Mock(return_value=Mock(json=lambda:{'access_token':'mock-token'}))), patch('app.requests.get',Mock(return_value=Mock(json=lambda:{'id':228398289,'login':'l3gh'}))), sync_playwright() as p:
            response=client.get('/admin/login',base_url='https://media.l3gh.com')
            state=parse_qs(urlparse(response.location).query)['state'][0]
            response=client.get('/auth/github/callback',query_string={'state':state,'code':'mock-code'},base_url='https://media.l3gh.com')
            assert response.status_code==302
            cookie=client.get_cookie('__Host-gallery',domain='media.l3gh.com').value
            client=app.test_client(use_cookies=False)
            browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
            context=browser.new_context()
            context.add_cookies([dict(name='__Host-gallery',value=cookie,domain='media.l3gh.com',path='/',secure=True,httpOnly=True,sameSite='Lax')])
            page=context.new_page()
            page.route('**/*',dispatch)
            page.goto('https://media.l3gh.com/admin')
            assert page.url=='https://media.l3gh.com/admin'
            assert page.locator('form[action="/admin/upload"] input[name="csrf"]').input_value()
            image=io.BytesIO(); Image.new('RGB',(16,16)).save(image,'PNG')
            page.locator('input[type=file]').set_input_files(dict(name='safe.png',mimeType='image/png',buffer=image.getvalue()))
            with page.expect_navigation() as navigation:
                page.get_by_role('button',name='Upload draft').click()
            assert navigation.value.status==expected
            assert submissions[-1]['cookie'] and submissions[-1]['multipart']
            assert submissions[-1]['origin']==('null' if policy else 'https://media.l3gh.com')
            with sqlite3.connect(Path(directory)/'gallery.sqlite') as db:
                assert db.execute('SELECT count(*) FROM items WHERE published=0').fetchone()[0]==(1 if expected==200 else 0)
            print('browser multipart', 'previous policy' if policy else 'fixed policy', submissions[-1], 'final status',navigation.value.status)
            browser.close()

if __name__=='__main__':
    verify('no-referrer',403)
    verify(None,200)
