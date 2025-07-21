FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl build-essential libssl-dev pkg-config nano \
    git vim htop tmux wget zsh bash-completion \
    locales sudo less procps \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configure locale
RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

# Install Oh My Zsh for better shell experience
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# Set Zsh as default shell
RUN chsh -s /bin/zsh root

# Add Rust to PATH
ENV PATH="/root/.cargo/bin:$PATH"

# Verify Rust installation
RUN rustc --version

# Install Solana CLI
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
RUN curl -sSfL https://release.anza.xyz/stable/install | sh \
    && echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.zshrc

# # Install Node.js (for development)
# RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
#     && apt-get install -y nodejs

# # Install Anchor CLI
# RUN cargo install --git https://github.com/coral-xyz/anchor avm --locked --force \
#     && avm install latest \
#     && avm use latest

# Generate keypair
RUN solana-keygen new --no-bip39-passphrase

# Configure Solana
RUN solana config set --url localhost --keypair /root/.config/solana/id.json

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]