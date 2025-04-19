FROM debian:bullseye-slim

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

# Rest of your existing Dockerfile...
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Install Solana CLI
RUN curl -sSfL https://release.anza.xyz/stable/install | sh \
    && echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.zshrc

# COPY ./id.json /root

RUN solana-keygen new  --no-bip39-passphrase

RUN solana config set --url localhost --keypair /root/.config/solana/id.json

# # Install Solana CLI
# RUN sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)" \
#     && echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"'

# # Add Solana CLI to PATH
# ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# # Verify Solana CLI installation
# RUN solana --version

# # Set up Solana config for Devnet
# RUN solana config set -ud

# # Install Node.js and Yarn
# RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
#     && apt-get install -y nodejs \
#     && npm install -g yarn

# # Install anchor version manager
# RUN cargo install --git https://github.com/coral-xyz/anchor avm --force

# # Set 0.28.0, latest version does not work with seahorse 2.0 atm
# RUN echo "y" | avm use 0.29.0

# # Install seahorse-dev
# RUN cargo install seahorse-dev

# # Set working directory
# WORKDIR /root


# CMD ["/bin/zsh"]
# Use zsh as the default shell
CMD ["solana-test-validator"]