python -m SimpleHTTPServer 8000



“1-second Burst Limit” means the maximum number of requests per second that the CARTO APIs will serve at the start of a period of activity measured in one-second intervals, and which is based on the generic cell rate and leaky bucket algorithms. Burst Limit takes priority over the Request Limit: when a request arrives in a one-second interval, the request is first checked against the Burst Limit. If the Burst Limit is exceeded, the request is rejected even if the Request Limit has not been exceeded.
