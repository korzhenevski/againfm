#!/usr/bin/env python
# -*- coding: utf-8 -*-

from lxml import etree as ET
from lxml.builder import E, ElementMaker

S = ElementMaker(namespace='http://sphinxsearch.com/', nsmap={'sphinx': 'http://sphinxsearch.com/'})


class SphinxPipe(object):
    def __init__(self):
        self.docset = S.docset()
        self.schema = S.schema()

    def AddField(self, name, attr=None):
        node = S.field(name=name)
        if attr:
            node.set('attr', attr)
        self.schema.append(node)

    def AddAttr(self, attr, attr_type, **opts):
        self.schema.append(S.attr(name=attr, type=attr_type, **opts))

    def AddDoc(self, doc_id, doc):
        node = S.document(id=unicode(doc_id))
        for key, val in doc.iteritems():
            node.append(getattr(E, key)(val))
        self.docset.append(node)

    def GetXml(self):
        self.docset.insert(0, self.schema)
        return ET.tostring(self.docset, pretty_print=True, xml_declaration=True, encoding='UTF-8')
