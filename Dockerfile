FROM node:20.12.0-alpine AS base
WORKDIR /app
CMD [ "npm", "start" ]

FROM base AS prod

ENV NODE_ENV=production

COPY ./src/package.json /app/package.json
COPY ./src/yarn.lock /app/yarn.lock

RUN yarn install --production

COPY ./src /app

CMD [ "yarn", "prod" ]
