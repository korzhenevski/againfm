#!/usr/bin/env python
# -*- coding: utf-8 -*-
import pyes

class Search(object):
    def __init__(self):
        # add configure
        self.es = pyes.ES()
        self.index_name = 'againfm'

    def index(self, doc, doc_type, object_id, **kwargs):
        return self.es.index(doc, self.index_name, doc_type, id=object_id, **kwargs)

    def refresh(self):
        self.es.indices.refresh(self.index_name)