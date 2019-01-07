FROM node:8 as build
COPY . /app
WORKDIR /app

# we install the dev dependencies as we dont want other downstream projects (like portal) to have
# conflicts with express versions due to this packaging in a Docker container
RUN yarn --non-interative

FROM node:8-alpine
WORKDIR /app
COPY --from=build /app /app
CMD [ "yarn", "start" ]
