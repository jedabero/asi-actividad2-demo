FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install

COPY . .

# Next build (produce .next/)
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start", "--", "-p", "3000"]