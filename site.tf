provider "aws" {
  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region = "${var.aws_region}"
}

provider "cloudflare" {
  email = "${var.cloudflare_email}"
  token = "${var.cloudflare_api_key}"
}

resource "aws_s3_bucket" "bucket" {
  bucket = "${var.website_domain}"
  acl = "public-read"
  versioning {
    enabled = true
  }
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "allow_public_read_all",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${var.website_domain}/*"
    }
  ]
}
EOF
  website {
    index_document = "index.html"
  }
}

resource "aws_s3_bucket_object" "html_file" {
  bucket = "${aws_s3_bucket.bucket.id}"
  key = "index.html"
  acl = "public-read"
  source = "build/index.html.gz"
  content_type = "text/html"
  content_encoding = "gzip"
  cache_control = "public, max-age=3600"
  etag = "${md5(file("build/index.html.gz"))}"
}

resource "aws_s3_bucket_object" "js_file" {
  bucket = "${aws_s3_bucket.bucket.id}"
  key = "app.js"
  acl = "public-read"
  source = "build/app.js.gz"
  content_type = "application/javascript"
  content_encoding = "gzip"
  cache_control = "public, max-age=3600"
  etag = "${md5(file("build/index.html.gz"))}"
}

resource "cloudflare_record" "domain_name" {
  domain = "${var.cloudflare_domain}"
  name = "tracemap"
  value = "${aws_s3_bucket.bucket.website_domain}"
  type = "CNAME"
  proxied = true
}
