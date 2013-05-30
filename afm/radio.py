import re
import urllib2
import httplib
import socket
import urlnorm
import requests
from time import time
from urlparse import urljoin
from httplib import LineAndFileWrapper, BadStatusLine

USER_AGENT = 'Mozilla/5.0 (compatible; checkfm/1.0)'
PLAYER_USER_AGENT = 'iTunes/10.2.1 (compatible; checkfm/1.0)'

PLAYLIST_ALLOWED_TYPES = (
    'audio/x-mpegurl', 'audio/x-scpls', 'application/pls+xml', 'audio/scpls',
    'text/html', 'text/plain', 'audio/scpls', 'audio/mpegurl',)


class FetchStreamResult(object):
    def __init__(self):
        self.error = None
        self.time = time()
        self.meta = {}
        self.bitrate = 0
        self.metaint = 0
        self.content_type = u''
        self.is_shoutcast = False
        self._headers = {}

    @property
    def headers(self):
        return self._headers

    @headers.setter
    def headers(self, value):
        self._headers = value
        # filter ICY prefixed headers to special "meta" dict
        for name, val in self._headers.iteritems():
            meta_name = re.sub(r'(ic[ye]|x-audiocast)-', '', name)
            if meta_name != name:
                self.meta[meta_name] = val

    def __repr__(self):
        fmt = u'<RadioResponse: {content_type}, bitrate: {bitrate}, metaint: {metaint}, time: {time}, ' \
              u'shoutcast: {is_shoutcast}>'
        return fmt.format(**self.__dict__)


def normalize_url(url, path=None):
    try:
        if path:
            url = urljoin(url, path)
        url = urlnorm.norm(url)
        # force HTTP protocol
        if url.startswith('http'):
            return url
    except urlnorm.InvalidUrl:
        pass


def normalize_content_type(content_type):
    return content_type.split(';')[0].lower().strip()


def safe_int(value, default=0):
    try:
        return int(value)
    except ValueError:
        return default


def fetch_stream(url, timeout=5, shoutcast=False):
    client = None
    result = FetchStreamResult()
    user_agent = USER_AGENT

    try:
        req = urllib2.Request(url, None, {'User-Agent': user_agent, 'Icy-Metadata': '1'})
        client = urllib2.urlopen(req, timeout=timeout)
    except urllib2.HTTPError as exc:
        result.error = 'HTTP Error: %s' % exc.code
    except urllib2.URLError as exc:
        if isinstance(exc.reason, socket.timeout):
            result.error = 'Timeout (%d secs.)' % timeout
        else:
            result.error = 'URL Error: %s' % exc.reason
    except Exception as exc:
        result.error = 'Error: %s' % exc

    result.time = float('%.4f' % (time() - result.time))

    if not result.error:
        headers = dict([(name.lower(), val.decode('utf8', 'ignore')) for name, val in client.info().items()])
        content_type = normalize_content_type(headers.get('content-type', ''))
        result.headers = headers
        result.content_type = content_type

        if content_type.startswith('audio/') or content_type == 'application/octet-stream':
            result.metaint = safe_int(headers.get('icy-metaint', ''))
            # guess bitrate
            bitrate = 0
            for name in ('bitrate', 'br'):
                if name in result.meta:
                    bitrate = result.meta.get(name)
            result.bitrate = safe_int(bitrate)
        elif content_type == 'text/html':
            page_content = client.read(1024)
            if not shoutcast and 'SHOUTcast Administrator' in page_content:
                result = fetch_stream(url + ';', shoutcast=True)
                result.is_shoutcast = True
            else:
                result.error = 'Invalid content type: text/html'
        else:
            result.error = 'Invalid content type: %s' % content_type

    if client:
        client.close()

    return result


class FetchPlaylistResult(object):
    def __init__(self):
        self.error = None
        self.content_type = None
        self.urls = []
        self.time = time()

    def __repr__(self):
        if self.error:
            fmt = u'<FetchPlaylistResult: error: "{error}", time: {time}>'
        else:
            fmt = u'<FetchPlaylistResult: content_type: {content_type}, time: {time}>'
        return fmt.format(**self.__dict__)

    def as_dict(self):
        return self


def fetch_playlist(url, timeout=5):
    result = FetchPlaylistResult()
    response = None

    headers = {'User-Agent': USER_AGENT}
    try:
        response = requests.get(url, timeout=timeout, headers=headers, stream=True)
    except requests.exceptions.RequestException as exc:
        result.error = unicode(exc)

    if result.error:
        result.time = time() - result.time
        return result

    content_type = normalize_content_type(response.headers.get('content-type', ''))
    allowed_types = ('audio/x-mpegurl', 'audio/x-scpls', 'application/pls+xml', 'audio/scpls',
                     'text/html', 'text/plain', 'audio/scpls', 'audio/mpegurl',)

    result.content_type = content_type

    if content_type in allowed_types:
        result.urls = parse_playlist(response.text)
    else:
        result.error = u'Invalid content type: {}'.format(content_type)

    result.time = time() - result.time
    return result


def parse_playlist(text):
    regex = r"(?im)^(file(\d+)=)?(http(.*?))$"
    urls = set([normalize_url(match.group(3).strip()) for match in re.finditer(regex, text)])
    return filter(None, urls)


def parse_playlist_source(source, baseurl):
    rex = r'(?i)href="?((.*?)\.(pls|m3u))"?'
    urls = set([match.group(1).strip() for match in re.finditer(rex, source, flags=re.IGNORECASE)])
    return filter(None, [normalize_url(baseurl, url) for url in urls])


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
