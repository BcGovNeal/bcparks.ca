const p = require("phin");

const GITHUB_OWNER = "bcgov";
const GITHUB_REPO = "bcparks.ca";
const GITHUB_API_URL = "https://api.github.com";

const OPENSHIFT_AUTH_TOKEN = "";
const OPENSHIFT_API_URL =
  "https://api.silver.devops.gov.bc.ca:6443/apis/image.openshift.io/v1";
const TOOLS_NAMESPACE = "61d198-tools";
const OPENSHIFT_IMAGETAG_URL = `${OPENSHIFT_API_URL}/namespaces/${TOOLS_NAMESPACE}/imagestreamtags`;

const IMAGETAGS_TO_KEEP = ["latest", "dev", "test", "prod"];
const IMAGESTRAMS_TO_CLEAN = ["admin", "landing", "public-builder", "strapi"];
const NUM_GIT_TAGS_TO_KEEP = 10;

const DATE_CUTOFF = new Date();
DATE_CUTOFF.setDate(DATE_CUTOFF.getDate() - 60);
console.log(DATE_CUTOFF);

const gitTagCommits = [];

/**
 * Retrieve the top NUM_GIT_TAGS_TO_KEEP git tag hashes
 */
async function retrieveRepoTags() {
  const res = await p({
    url: `${GITHUB_API_URL}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/tags?per_page=${NUM_GIT_TAGS_TO_KEEP}`,
    headers: {
      "User-Agent": "GitTagRetriever/1.0",
    },
    parse: "json",
  });

  for (const item of res.body) {
    // cache just the short sha hash
    gitTagCommits.push(item.commit.sha.substring(0, 7));
  }
}

async function retrieveOpenShiftImageTags() {
  const res = await p({
    url: OPENSHIFT_IMAGETAG_URL,
    headers: {
      Authorization: OPENSHIFT_AUTH_TOKEN,
    },
    parse: "json",
  });

  for (const item of res.body.items) {
    const tokens = item.metadata.name.split(":");
    const imageName = tokens[0];
    const tagName = tokens[1];
    const creationTimestamp = new Date(item.metadata.creationTimestamp);

    if (shouldCleanImage(imageName, tagName, creationTimestamp)) {
      console.log(imageName, tagName, creationTimestamp);
    }
  }
}

function shouldCleanImage(name, tag, timestamp) {
  if (!IMAGESTRAMS_TO_CLEAN.includes(name)) return false;

  if (IMAGETAGS_TO_KEEP.includes(tag)) return false;

  if (gitTagCommits.includes(tag)) return false;

  if (timestamp > DATE_CUTOFF) return false;

  return true;
}

async function run() {
  if (!OPENSHIFT_AUTH_TOKEN) throw Error("OpenShift auth token not set");

  await retrieveRepoTags();

  console.log(gitTagCommits);

  await retrieveOpenShiftImageTags();
}

run();
