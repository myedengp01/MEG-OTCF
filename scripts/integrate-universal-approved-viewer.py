#!/usr/bin/env python3
"""Apply one narrowly-scoped read-only OTCF Approved Claims integration.

Run in the feature branch ONLY. Refuses unexpected index changes and duplicate wiring.
This is an interim development integration, not a deployment or UVN release.
"""
from pathlib import Path
import hashlib

TARGET = Path('index.html')
EXPECTED_BLOB = 'a4340d057a55cc1c1d8f9f19b4e426337aed93fb'
INSERT = ('<script src="./src/universal-claim-view-model.js"></script>\n'
          '<script src="./src/universal-approved-viewer.js"></script>\n')
TAIL = '</body>\n</html>'


def git_blob_sha(raw: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()


def main():
    assert Path('src/universal-claim-view-model.js').is_file(), 'Missing tested status adapter'
    assert Path('src/universal-approved-viewer.js').is_file(), 'Missing approved viewer enhancer'
    raw = TARGET.read_bytes()
    current_sha = git_blob_sha(raw)
    assert current_sha == EXPECTED_BLOB, f'Unexpected index.html blob {current_sha}; review changes manually'
    source = raw.decode('utf-8')
    assert source.count(TAIL) == 1, 'Unexpected HTML ending'
    assert INSERT not in source, 'Scripts already integrated'
    assert source.count('window.renderViewerClaims = async function(){') == 1, 'Approved viewer changed; inspect before integration'
    patched = source.replace(TAIL, INSERT + TAIL, 1)
    assert patched.count(INSERT) == 1, 'Integration not unique'
    TARGET.write_bytes(patched.encode('utf-8'))
    print('PASS: guarded read-only OTCF Approved Claims integration; scripts loaded at end of body')
    print('NOTE: do not merge/deploy; role, browser and cross-app tests and UVN sync remain pending')


if __name__ == '__main__':
    main()
