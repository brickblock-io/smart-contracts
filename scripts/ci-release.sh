echo "git checkout master && git pull"
git checkout master && git pull

echo "yarn release"
yarn release

echo "git config --global user.name \"gitlab-bot\""
git config --global user.name "gitlab-bot"

echo "git config --global user.email \"git@brickblock.io\""
git config --global user.email "git@brickblock.io"

echo "git config --global push.default current"
git config --global push.default current

echo "npm publish"
npm publish

# This command has been a little fragile so we run it last. In case it fails, at least
# we'll have successfully published to npm and can manually bump the version number
# in package.json later on.
echo "git push https://gitlab-bot:\$SECRET_GITLAB_BOT_CI_TOKEN@git.brickblock-dev.io/${CI_PROJECT_PATH}.git/ --follow-tags"
git push https://gitlab-bot:${SECRET_GITLAB_BOT_CI_TOKEN}@git.brickblock-dev.io/${CI_PROJECT_PATH} master --follow-tags
