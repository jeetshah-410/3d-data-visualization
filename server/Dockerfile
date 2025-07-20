# Use an official lightweight Node image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy only package.json and lock file first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the server files
COPY . .

# Expose the backend port (adjust if needed)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
