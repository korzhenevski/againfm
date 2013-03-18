#!/usr/bin/env python
# -*- coding: utf-8 -*-
import re
import urlnorm
from urlparse import urljoin

def normalize_url(url, path=None):
    try:
        if path:
            url = urljoin(url, path)
        return urlnorm.norm(url)
    except urlnorm.InvalidUrl:
        pass

def parse_playlist(text):
    regex = r"(?im)^(file(\d+)=)?(http(.*?))$"
    urls = set([normalize_url(match.group(3).strip()) for match in re.finditer(regex, text)])
    return filter(None, urls)
