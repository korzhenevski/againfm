#!/usr/bin/env python
# -*- coding: utf-8 -*-

from __future__ import absolute_import
from celery import Celery

celery = Celery('checkfm.celery',
                broker='mongodb://localhost:27017/againfm',
                backend='mongodb://localhost:27017/againfm',
                include=['checkfm.tasks'])

# Optional configuration, see the application user guide.
celery.conf.update(CELERY_TASK_RESULT_EXPIRES=3600,)

if __name__ == '__main__':
    celery.start()