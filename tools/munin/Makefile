MUNIN_PLUGINS_DIR=/etc/munin/plugins
MUNIN_PLUGINS_CONFIG_DIR=/etc/munin/plugin-conf.d
PWD=$(shell pwd)

all: cdbsqlapi.conf

cdbsqlapi.conf: cdbsqlapi.conf.in
	sed 's#@PWD@#$(PWD)#' < $< > $@

install-munin-plugin-conf: cdbsqlapi.conf 
	install -m 644 $< $(MUNIN_PLUGINS_CONFIG_DIR)/cdbsqlapi.conf

install-munin-plugin: cdbsqlapi
	install -m 755 $< $(MUNIN_PLUGINS_DIR)/cdbsqlapi

install: install-munin-plugin install-munin-plugin-conf

clean:
	rm -f cdbsqlapi.conf
