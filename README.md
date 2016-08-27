# adfs-s3
A Proxy for AWS S3 using ADFS for authentication

### How to run

#### Locally, or
```
$ make start_local
```

#### Via Docker
```
$ make start
```


Then visit `localhost:3000/s3/{bucket}/{key}`, when prompted, type your ADFS username and password.
