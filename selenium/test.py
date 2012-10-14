from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
import unittest
from time import time

class UserCase(unittest.TestCase):
    def setUp(self):
        self.verificationErrors = []
        self.driver = webdriver.Chrome()
        self.baseurl = 'http://againfm.local/'
        self.driver.get(self.baseurl)
    """
    def test_invalid_login(self):
        form = self.driver.find_element_by_css_selector('form.login')
        form.find_element_by_name('login').send_keys('no-such-user@example.com')
        form.find_element_by_name('password').send_keys(str(time()))
        form.submit()

        checker = lambda driver: driver.find_element_by_css_selector('form.login .notice-error').is_displayed()
        WebDriverWait(self.driver, 1).until(checker)

    def test_valid_login_logout(self):
        self._test_login()
        WebDriverWait(self.driver, 1).until(lambda driver: driver.find_element_by_class_name('user-profile').is_displayed())
        profile = self.driver.find_element_by_class_name('user-profile')
        self.assertTrue(profile.is_displayed())
        profile.find_element_by_class_name('logout').click()
        WebDriverWait(self.driver, 1).until(lambda driver: not profile.is_displayed())
    """

    def test_signup(self):
        self.driver.find_element_by_css_selector('a.signup').click()
        WebDriverWait(self.driver, 1).until(lambda driver: driver.find_element_by_css_selector('form.signup').is_displayed())

    def _test_login(self):
        form = self.driver.find_element_by_css_selector('form.login')
        form.find_element_by_name('login').send_keys('test@testing.com')
        form.find_element_by_name('password').send_keys('password')
        form.submit()

    def tearDown(self):
        self.driver.quit()

def tearDown(self):
        self.driver.quit()

if __name__ == "__main__":
    unittest.main()
