import requests

class VKApi(object):
    def __init__(self, access_token, url=None):
        if url is None:
            url = 'https://api.vk.com/'
        self.url = url
        self.access_token = access_token

    def request(self, method, params=None):
        if params is None:
            params = {}
        params['access_token'] = self.access_token
        url = '{}/method/{}'.format(self.url, method)
        response = requests.get(url, params=params)
        if not response.ok:
            response.raise_for_status()
        result = (response.json or {})
        if 'error' in result:
            raise VKError(result['error'])
        result = result.get('response')
        if not result:
            raise Exception('VKApi {} empty response'.format(method))
        return result

class VKError(Exception):
    __slots__ = ["error"]
    def __init__(self, error_data):
        self.error = error_data
        Exception.__init__(self, str(self))

    @property
    def code(self):
        return self.error['error_code']

    @property
    def description(self):
        return self.error['error_msg']

    @property
    def params(self):
        return self.error['request_params']

    def __str__(self):
        return "Error(code = '%s', description = '%s', params = '%s')" % (self.code, self.description, self.params)