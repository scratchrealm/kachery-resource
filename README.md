# kachery-resource

A Kachery resource is a very useful tool if you need to make a large number of local files available on the Kachery network without having to upload them in advance. This is beneficial if you believe only a limited number of files will be requested, as you don't have to predict which files will be requested ahead of time. This can also help save a considerable amount of bandwidth and cloud storage space that would otherwise be used.

## How it works

To share files from your local machine to remote Kachery clients, you run a kachery-resource daemon on your local computer, and connect it to a [kachery-resource-proxy](https://github.com/scratchrealm/kachery-resource-proxy/blob/main/README.md) server in the cloud. Then, on a remote machine that is configured for the same zone as the resource, a Kachery client can be used to request the file. If the file is not already in the cloud, the daemon will upload it to the cloud bucket for the Kachery zone, and the remote client will then be able to download it.

## Installation

Prerequisites:
* NodeJS >= v16

There is no need to clone this repo.

## Setup

For the below, let's assume the name of your resource is `example_resource`. Of course, you should choose a different name.

**Step 1: Set up kachery**

Make sure you have set the following environment variables appropriately (see [kachery-cloud](https://github.com/flatironintstitute/kachery-cloud)):

```bash
# Set the kachery zone as appropriate
export KACHERY_ZONE=...

# Set the kachery storage as appropriate
export KACHERY_CLOUD_DIR=...
```

Then make sure you have run `kachery-cloud-init` to initialize the kachery cloud directory for your zone, as described in the [kachery-cloud docs](https://github.com/flatironintstitute/kachery-cloud).

**Step 2: Identify a kachery-resource-proxy server**

In order for remote computers to communicate with your locally-hosted resource, you need a proxy server. You can either [host the server yourself](https://github.com/scratchrealm/kachery-resource-proxy/blob/main/README.md) or use one maintained by someone else. Contact the authors for help finding a proxy server.

Obtain the Proxy URL and Proxy secret for the proxy server. These will be used below.

For this guide, let's assume the Proxy URL is `https://kachery-resource-proxy.herokuapp.com`

**Step 3: Initialize the resource on your local machine**

On the computer that has the files you want to share, initialize the resource:

```bash
# Create a directory where your configuration files will reside
mkdir example_resource

# Initialize the resource
cd example_resource
npx kachery-resource@latest init

# Respond to the prompts
# * Give the resource a name
# * Provide the name of the kachery zone
# * Specify the maximum number of concurrent uploads
# * Provide the Proxy URL and the proxy secret obtained above
```

This will create a kachery-resource.yaml file in your configuration directory.

**Step 4: Run the resource daemon**

**Important:** For this step, make sure you are in an environment (conda or otherwise) where kachery-cloud is installed and available. You can test this by running

```bash
kachery-cloud --help
```

To run the resource daemon:

```bash
cd example_resource
npx kachery-resource@latest share

# keep this daemon running in a terminal
```

## Downloading files on a remote computer

On the computer hosting the resource, identify a file that you want to share and store it locally:

```python
import kachery_cloud as kcl

uri = kcl.store_file_local('/path/to/file.dat')
# or
uri = kcl.link_file('/path/to/file.dat')

# Use link_file to avoid creating an additional copy of large files
```

Let's assume that the URI is `sha1://a6770efde8f0d4ff9bed02982b73c6d298363d61`.


Now, on a remote computer, where you want to download the files, set the following environment variables

```bash
# Set the kachery zone as appropriate (must coincide with the zone of the resource)
export KACHERY_ZONE=...

# For the resource URL using the proxy URL and the resource name
export KACHERY_RESOURCE_URL=https://kachery-resource-proxy.herokuapp.com/r/example_resource
```

Then load the file as usual (as though the file was already uploaded to the zone):

```python
import kachery_cloud as kcl

uri = 'sha1://a6770efde8f0d4ff9bed02982b73c6d298363d61'
fname = kcl.load_file(uri)
```
