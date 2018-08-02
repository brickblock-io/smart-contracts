: "${SECRET_GITLAB_BOT_CI_TOKEN:?Environment variable SECRET_GITLAB_BOT_CI_TOKEN needs to be set as secret CI variable in GitLab before running this script}"

# Make sure to check out the latest master branch
echo "git checkout master && git pull"
git checkout master && git pull

# Act as gitlab-bot user who has push access to `master`
echo "git config --global user.name \"gitlab-bot\""
git config --global user.name "gitlab-bot"
echo "git config --global user.email \"git@brickblock.io\""
git config --global user.email "git@brickblock.io"
echo "git config --global push.default current"
git config --global push.default current

# Compiles all JSON ABIs of our contracts into the `.gitignore`d folder `./deployed-contracts`
echo "yarn build"
yarn build

# Auto-generate CHANGELOG.md and bump version number in package.json
echo "yarn release"
yarn release

# Push the freshly generated CHANGELOG.md and updated package.json
echo "git push https://gitlab-bot:\$SECRET_GITLAB_BOT_CI_TOKEN@git.brickblock.sh/${CI_PROJECT_PATH}.git/ master --follow-tags"
git push https://gitlab-bot:"$SECRET_GITLAB_BOT_CI_TOKEN"@git.brickblock.sh/"$CI_PROJECT_PATH" master --follow-tags

# Publish new version on npm
echo "npm publish"
npm publish
