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

# Rest of your existing Dockerfile...
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Set working directory
WORKDIR /solana-token

# Use zsh as the default shell
CMD ["/bin/zsh"]