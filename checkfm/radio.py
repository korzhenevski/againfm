import re
import urllib2
import httplib
import socket
from time import time
from urlparse import urlparse

from httplib import LineAndFileWrapper, BadStatusLine

class ShoutcastHTTPResponse(httplib.HTTPResponse):
    def _read_status(self):
        # Initialize with Simple-Response defaults
        line = self.fp.readline()
        status = 0
        reason = ""
        if self.debuglevel > 0:
            print "reply:", repr(line)
        if not line:
            # Presumably, the server closed the connection before
            # sending a valid response.
            raise BadStatusLine(line)
        try:
            [version, status, reason] = line.split(None, 2)
        except ValueError:
            try:
                [version, status] = line.split(None, 1)
                reason = ""
            except ValueError:
                # empty version will cause next test to fail and status
                # will be treated as 0.9 response.
                version = ""

        # Shoutcast "Fancy" HTTP fix
        if version == 'ICY':
            version = 'HTTP/1.0'

        if not version.startswith('HTTP/'):
            if self.strict:
                self.close()
                raise BadStatusLine(line)
            else:
                # assume it's a Simple-Response from an 0.9 server
                self.fp = LineAndFileWrapper(line, self.fp)
                return "HTTP/0.9", 200, ""

        # The status code is a three-digit number
        try:
            status = int(status)
            if status < 100 or status > 999:
                raise BadStatusLine(line)
        except ValueError:
            raise BadStatusLine(line)
        return version, status, reason

httplib.HTTPConnection.response_class = ShoutcastHTTPResponse


class RadioResponse(object):
    def __init__(self):
        self.error = None
        self.time = time()
        self.meta = {}
        self.bitrate = None
        self.metaint = None
        self.content_type = None
        self.is_shoutcast = False
        self._headers = {}

    @property
    def headers(self):
        return self._headers

    @headers.setter
    def headers(self, value):
        self._headers = value
        self.meta = dict([(re.sub(r'(ic[ye]|x-audiocast)-', '', k), v) for k, v in self._headers.iteritems()])

    def __repr__(self):
        fmt = u'<RadioResponse: {content_type}, bitrate: {bitrate}, metaint: {metaint}, time: {time}, ' \
              u'shoutcast: {is_shoutcast}>'
        return fmt.format(**self.__dict__)


def safe_int(value, default=0):
    try:
        return int(value)
    except ValueError:
        return default


def fetch_radio_stream(url, timeout=5, user_agent=None):
    client = None
    url = urlparse(url)
    response = RadioResponse()

    if user_agent is None:
        user_agent = 'WinampMPEG/5.0'

    try:
        req = urllib2.Request(url.geturl(), None, {'User-Agent': user_agent, 'Icy-Metadata': '1'})
        client = urllib2.urlopen(req, timeout=timeout)
    except urllib2.HTTPError as exc:
        response.error = 'HTTP Error: %s' % exc.code
    except urllib2.URLError as exc:
        if isinstance(exc.reason, socket.timeout):
            response.error = 'Request timeout (%d secs.)' % timeout
        else:
            response.error = 'URL Error: %s' % exc.reason
    except Exception as exc:
        response.error = 'Error: %s' % exc

    response.time = float('%.4f' % (time() - response.time))

    if not response.error:
        headers = dict([(name.lower(), val) for name, val in client.info().items()])
        content_type = headers.get('content-type', '').split(';')[0].lower().strip()
        response.headers = headers
        response.content_type = content_type

        if content_type.startswith('audio/') or content_type == 'application/octet-stream':
            response.metaint = safe_int(headers.get('icy-metaint'))
            # guess bitrate
            bitrate = 0
            for name in ('ice-bitrate', 'icy-br', 'x-audiocast-bitrate'):
                if name in headers:
                    bitrate = headers.get(name)
            response.bitrate = safe_int(bitrate)
        elif content_type == 'text/html':
            page_content = client.read(8096)
            if 'SHOUTcast Administrator' in page_content:
                # Bitrate is important for stream selection,
                # extract value from Shoutcast Info HTML.
                bitrate_match = re.search(r"at (\d+) kbps", page_content, re.IGNORECASE)
                if bitrate_match:
                    response.bitrate = safe_int(bitrate_match.group(1))
                response.is_shoutcast = True
            else:
                response.error = 'Invalid content type: text/html'
        else:
            response.error = 'Invalid content type: %s' % content_type

    if client:
        client.close()

    return response

if __name__ == '__main__':
    from pprint import pprint
    pprint(fetch_radio_stream('http://pub3.di.fm:80/di_bigroomhouse', user_agent='Winamp'))