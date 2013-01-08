class Job(object):
    pass

class JobState(object):
    pass

import pymongo
from redis import Redis

class Manager(object):
    worker_status = {}
    worker_jobs = {}

    def __init__(self, redis=None, db=None):
        self.redis = redis
        if self.redis is None:
            self.redis = Redis()

        self.db = db

    def cleanup_jobs(self):
        pass

    def fetch_url(self, url, content_type_limit=None, parse_stream=False, save_stream=False):
        pass

    def get_state(self, job_id):
        pass

    def worker_request_job(self, worker_id):
        pass

    def process_job_event(self, job_event):
        pass

    def get_stream(self, station_id):
        pass

db = pymongo.Connection()['againfm']
manager = Manager(db=db)