# kachery-resource

When you host a Kachery resource, you share files stored locally without having to upload them to a Kachery cloud storage bucket in advance. This is useful when you want to make a large number of files available, but you only expect a small number of them to be requested. You don't need to know which files will be requested in advance.

## How it works

To share files on a local computer, you will need to run a kachery-resource daemon on that computer. This daemon will establish a connection with a [kachery-resource-proxy](https://github.com/scratchrealm/kachery-resource-proxy/blob/main/README.md) server in the cloud. Both the daemon and the proxy server should be associated with the same Kachery zone. Then, on a remote machine that is configured to work with that same zone, you can request the file using a Kachery Python client. If the file is not already in the cloud, the daemon will receive the request and upload it to the cloud bucket for the Kachery zone. It will then be available for download by the remote client.

## Installation

Prerequisites:
* NodeJS >= v16 (earlier versions may also work)

For now, during development, you'll need to install kachery-resource from scratch.

```bash
git clone <this-repo>

cd kachery-resource
npm install -g

# Test the installation
kachery-resource --help

# To get subsequent updates:
git pull
npm install -g
```

## Setup

For the below, let's assume the name of your resource is "example_resource". Of course, you should choose a different name.

**Step1: Identify a kachery-resource-proxy server**

In order for remote computers to communicate with your locally-hosted resource, you need a proxy server. You can either [host the server yourself](https://github.com/scratchrealm/kachery-resource-proxy/blob/main/README.md) or use one maintained by someone else. Contact the authors for help finding a proxy server.

Obtain the Proxy URL and Proxy secret for the proxy server. These will be used below.

**Step 2: Initialize the resource on your local machine**

Note that the Kachery zone of the proxy server must coincide with the KACHERY_ZONE environment variable on your local machine.

On the computer that has the files you want to share, initialize the resource:

```bash
# Create a directory where your configuration files will reside
mkdir example_resource

# Initialize the resource
cd example_resource
kachery-resource init

# Respond to the prompts
# * Give the resource a name
# * Provide the name of the kachery zone
# * Specify the maximum number of concurrent uploads
# * Provide the Proxy URL and the proxy secret obtained above
```

This will create a kachery-resource.yaml file in your configuration directory.

**Step 3: Register the resource on the Kachery zone**

In order for your resource to be locatable on the zone by name, you will need to register the resource.

Point your browser to the website for the zone (e.g., https://kachery-gateway-example-resource.vercel.app), login, and create a new resource. You will be asked to provide the name and the Proxy URL for the resource

**Step 4: Run the resource daemon**

To run the resource daemon:

```bash
cd example_resource
kachery-resource share

# keep this daemon running in a terminal
```

## Basic usage

On the computer hosting the resource, identify a file to be shared, and store it locally

```python
import kachery_cloud as kcl

uri = kcl.store_file_local('/path/to/file.dat')
# or
uri = kcl.link_file('/path/to/file.dat')

# Use link_file to avoid creating an additional copy of large files
```

Let's assume that the URI is `sha1://a6770efde8f0d4ff9bed02982b73c6d298363d61`.

Now, on a remote computer (that is using the same Kachery zone), request the file:

```python
import kachery_cloud as kcl

uri = 'sha1://a6770efde8f0d4ff9bed02982b73c6d298363d61'
R = kcl.request_file(
    uri,
    resource='example_resource',
    timeout_sec=10
)
R.found # whether the file was found
R.queued # whether the file has been queued for upload
R.completed # whether the upload has completed
R.running # whether the upload is running
R.local # whether the file was found locally
R.errored # whether the upload errored
R.error_message # the error message
R.size # the size of the found file
R.bytes_uploaded # the number of bytes loaded for an in-progress upload

if R.completed:
    path = kcl.load_file(uri)
    # or
    txt = kcl.load_text(uri)
    print(txt)
else:
    print('Upload not completed')
```

As you can see, the `request_file` function returns an object with information about the status of the upload. Once `R.completed` is true, you can load the file in the usual manner.