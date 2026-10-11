FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://starship.rs/install.sh | sh -s -- -y \
    && echo 'eval "$(starship init bash)"' >> /root/.bashrc
