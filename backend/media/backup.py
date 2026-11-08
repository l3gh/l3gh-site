"""Run as service user. Shared advisory lock coordinates app writes and archive."""
import fcntl, os, sqlite3, tarfile, tempfile, time
from pathlib import Path

def backup(data, dest):
    data=Path(data); dest=Path(dest); dest.mkdir(parents=True,exist_ok=True,mode=0o700)
    with (data/'media.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        with tempfile.TemporaryDirectory(dir=dest) as temp:
            snap=Path(temp)/'gallery.sqlite'
            with sqlite3.connect(data/'gallery.sqlite') as source, sqlite3.connect(snap) as target:
                source.backup(target)
                target.execute('DELETE FROM sessions'); target.execute('DELETE FROM limits'); target.commit()
            name=dest/(time.strftime('%Y%m%dT%H%M%S')+'-'+str(os.getpid())+'.tar.gz')
            partial=name.with_suffix('.partial')
            try:
                with tarfile.open(partial,'w:gz') as archive:
                    archive.add(snap,arcname='gallery.sqlite')
                    for d in ('originals','derivatives'): archive.add(data/d,arcname=d)
                os.chmod(partial,0o600); partial.rename(name)
            finally: partial.unlink(missing_ok=True)
    for old in sorted(dest.glob('*.tar.gz'))[:-7]: old.unlink()
    return name
if __name__=='__main__':
    backup(os.environ.get('DATA','/var/lib/l3gh-media'),os.environ.get('BACKUP_DEST','/var/backups/l3gh-media'))
