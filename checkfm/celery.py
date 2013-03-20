#!/usr/bin/env python
# -*- coding: utf-8 -*-

from __future__ import absolute_import
from celery import Celery

celery = Celery('checkfm.celery',
                broker='mongodb://localhost:27017/celery',
                backend='redis://localhost:6379/0',
                include=['checkfm.tasks'])

# Optional configuration, see the application user guide.
celery.conf.update(CELERY_TASK_RESULT_EXPIRES=3600, CELERY_RESULT_BACKEND='redis://localhost:6379/0')

if __name__ == '__main__':
    celery.start()