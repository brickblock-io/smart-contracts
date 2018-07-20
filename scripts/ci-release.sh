: "${GITLAB_BOT_CI_TOKEN:?Environment variable GITLAB_BOT_CI_TOKEN needs to be set as secret CI variable in GitLab before running this script}"

# This perl command extracts the ssh/git URL because the runner uses a tokenized URL
export CI_PUSH_REPO=`echo $CI_REPOSITORY_URL | perl -pe 's#.*@(.+?(\:\d+)?)/#git@\1:#'`

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

echo "git remote set-url --push origin \"${CI_PUSH_REPO}\""
git remote set-url --push origin "${CI_PUSH_REPO}"

echo "npm publish"
npm publish

echo "git push https://gitlab-bot:\$SECRET_GITLAB_BOT_CI_TOKEN@git.brickblock-dev.io/${CI_PROJECT_PATH}.git/ --follow-tags"
git push https://gitlab-bot:${SECRET_GITLAB_BOT_CI_TOKEN}@git.brickblock-dev.io/${CI_PROJECT_PATH} master --follow-tags
