#!/usr/bin/env python
# -*- coding: utf-8 -*-

import ujson as json

class I18n(object):
    def __init__(self, app):
        self._app = app
        self.dict = {}
        # плоский словарь
        self.flat_dict = {}
        self.load_dict(app.config.get('LOCALE', 'en'))

    def load_dict(self, locale):
        name = 'locale/{}.json'.format(locale)
        with self._app.open_resource(name) as f:
            self.dict = json.loads(f.read())
            self.flat_dict = DotCollapsedDict(self.dict)

    def translate(self, key):
        return self.flat_dict.get(key, key)

    def get_json_dict(self):
        return json.dumps(self.dict)

class DotCollapsedDict(dict):
    """
    A special dictionary constructor that take a dict and provides
    a dot collapsed dict:

    >>> DotCollapsedDict({'a':{'b':{'c':{'d':3}, 'e':5}, "g":2}, 'f':6})
    {'a.b.c.d': 3, 'a.b.e': 5, 'a.g': 2, 'f': 6}

    >>> DotCollapsedDict({'bla':{'foo':{unicode:{"bla":3}}, 'bar':'egg'}})
    {'bla.foo.$unicode.bla': 3, 'bla.bar': "egg"}

    >>> DotCollapsedDict({'bla':{'foo':{unicode:{"bla":3}}, 'bar':'egg'}}, remove_under_type=True)
    {'bla.foo':{}, 'bla.bar':unicode}

    >>> dic = {'bar':{'foo':3}, 'bla':{'g':2, 'h':3}}
    >>> DotCollapsedDict(dic, reference={'bar.foo':None, 'bla':{'g':None, 'h':None}})
    {'bar.foo':3, 'bla':{'g':2, 'h':3}}

    """
    def __init__(self, passed_dict, remove_under_type=False, reference=None):
        self._remove_under_type = remove_under_type
        assert isinstance(passed_dict, dict), "you must pass a dict instance"
        final_dict = {}
        self._reference = reference
        self._make_dotation(passed_dict, final_dict)
        self.update(final_dict)

    def _make_dotation(self, d, final_dict, key=""):
        for k,v in d.iteritems():
            if isinstance(k, type):
                k = "$%s" % k.__name__
            if isinstance(v, dict) and v != {}:
                if key:
                    _key = "%s.%s" % (key, k)
                else:
                    _key = k
                if self._reference and _key in self._reference:
                    final_dict[_key]=v
                if self._remove_under_type:
                    if [1 for i in v.keys() if isinstance(i, type)]:
                        v = v.__class__()
                        if not key:
                            final_dict[k] = v
                        else:
                            final_dict["%s.%s" % (key, k)] = v
                    else:
                        self._make_dotation(v, final_dict, _key)
                else:
                    self._make_dotation(v, final_dict, _key)
            else:
                if not key:
                    final_dict[k] = v
                else:
                    if not self._reference:
                        final_dict["%s.%s" % (key, k)] = v
                    elif "%s.%s" % (key, k) in self._reference:
                        final_dict["%s.%s" % (key, k)] = v