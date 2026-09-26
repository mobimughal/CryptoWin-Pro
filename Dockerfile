FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build frontend
COPY . .
RUN npm run build

# Hugging Face Spaces default port is 7860, standard web is 3000/8080
ENV PORT=7860
EXPOSE 7860 3000

CMD ["npm", "start"]
