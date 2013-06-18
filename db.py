#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask.ext.script import Manager
from afm import app, db
manager = Manager(app)


@manager.command
@manager.option('-obj', '--obj', dest='obj')
@manager.option('-oid', '--oid', dest='obj_id')
def rm(obj, obj_id):
    from afm.helpers import get_ts

    obj_id = int(obj_id)
    db[obj].update({'id': obj_id}, {'$set': {'deleted_at': get_ts()}})

    print 'deleted {} {}'.format(obj, obj_id)


@manager.command
@manager.option('-obj', '--obj', dest='obj')
@manager.option('-oid', '--oid', dest='obj_id')
def restore(obj, obj_id):
    obj_id = int(obj_id)
    db[obj].update({'id': obj_id}, {'$set': {'deleted_at': 0}})

    print 'restored {} {}'.format(obj, obj_id)


if __name__ == "__main__":
    manager.run()
