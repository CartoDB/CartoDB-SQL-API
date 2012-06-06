# TO RUN
# > virtualenv env
# > . env/bin/activate
# > pip install oauth2
# > pip install cartodb
#
# FILL IN THINGS BELOW
# > python oauth_test.py

from cartodb import CartoDB, CartoDBException

import httplib2
import oauth2 as oauth
if __name__ == '__main__':

    user = ''
    password = ''
    CONSUMER_KEY= ''
    CONSUMER_SECRET= ''
    cl = CartoDB(CONSUMER_KEY, CONSUMER_SECRET, user, password, 'simon')
    try:
        print cl.sql('select * from do_not_exist')
    except CartoDBException as e:
        print ("some error ocurred", e)
    print cl.sql('select * from table');

