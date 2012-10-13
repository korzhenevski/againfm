from selenium import selenium
import unittest, time, re

class test(unittest.TestCase):
    def setUp(self):
        self.verificationErrors = []
        self.selenium = selenium("localhost", 4444, "*chrome", "http://againfm.local/")
        self.selenium.start()
    
    def test_test(self):
        sel = self.selenium
        sel.open("/")
        sel.wait_for_page_to_load("60000")
        sel.type("name=login", "test@testing.com")
        sel.key_press("name=login", "\\13")
        sel.type("name=password", "password")
        sel.click("xpath=//div[@class='box-holder']/form/input")
        sel.wait_for_condition("selenium.browserbot.getCurrentWindow().$.active == 0", "1000")
    
    def tearDown(self):
        self.selenium.stop()
        self.assertEqual([], self.verificationErrors)

if __name__ == "__main__":
    unittest.main()
