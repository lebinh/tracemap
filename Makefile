plan: html js site.tf
	terraform plan --out=site.plan

deploy: site.plan
	terraform apply site.plan

html: build/index.html.gz

build/index.html.gz: src/index.html
	mkdir -p build
	gzip --to-stdout src/index.html > build/index.html.gz

js: build/app.js.gz

build/app.js.gz: src/app.js
	mkdir -p build
	gzip --to-stdout src/app.js > build/app.js.gz

clean:
	rm -rf build
