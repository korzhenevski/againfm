#!/usr/bin/env python
# -*- coding: utf-8 -*-

import re
import requests
import urlnorm
from urlparse import urljoin

def normalize_url(url, path=None):
    try:
        if path:
            url = urljoin(url, path)
        return urlnorm.norm(url)
    except urlnorm.InvalidUrl:
        pass
    return None

def extract_playlists(text, baseurl):
    regex = r'(?i)href="?((.*?)\.(pls|m3u))"'
    urls = set([match.group(1).strip() for match in re.finditer(regex, text, flags=re.IGNORECASE)])
    return filter(None, [normalize_url(baseurl, url) for url in urls])

def extract_streams(text):
    regex = r"(?im)^(file(\d+)=)?(http(.*?))$"
    urls = set([normalize_url(match.group(3).strip()) for match in re.finditer(regex, text)])
    return filter(None, urls)

def parse_source(source_url, single_result=False, stream_list=False):
    source_url = normalize_url(source_url)
    resp = requests.get(source_url)
    result = []

    if resp.ok:
        content_type = resp.headers.get('content-type', '')
        content_type = content_type.split(';')[0].lower()
        if content_type == 'text/html':
            print 'page %s' % source_url
            urls = extract_playlists(resp.text, baseurl=source_url)
            result.extend(filter(None, [parse_source(url, single_result=True) for url in urls]))
        elif content_type in ('audio/x-mpegurl', 'audio/x-scpls', 'text/plain'):
            print 'playlist %s' % source_url
            urls = extract_streams(resp.text)
            result.append((resp.status_code, source_url, urls))
    if single_result:
        return result[0] if result else None
    elif stream_list:
        streams = set([])
        for item in result:
            for stream_url in item[2]:
                streams.add(stream_url)
        return list(streams)

    return result

def main():
    assert normalize_url('http://TesT.com:80/test/../test') == 'http://test.com/test'
    assert normalize_url('http://googlE.com/', '/test/../index') == 'http://google.com/index'
    print(parse_source('http://mp3.radioultra.ru'))

if __name__ == '__main__':
    main()