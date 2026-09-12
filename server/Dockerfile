FROM emscripten/emsdk:4.0.10 AS emsdk
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake ninja-build clang lld git python3 ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*
COPY --from=dotnet /usr/share/dotnet /usr/share/dotnet
RUN ln -s /usr/share/dotnet/dotnet /usr/local/bin/dotnet
COPY --from=emsdk /emsdk /emsdk
ENV EMSDK=/emsdk
ENV PATH="/emsdk:/emsdk/upstream/emscripten:/emsdk/node/20.18.0_64bit/bin:${PATH}"
RUN /emsdk/emsdk activate latest
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev
COPY server/ ./server/
COPY src/ ./src/
COPY wasm/ ./wasm/
ENV WIICOMPILED_DIR=/vendor/wiicompiled
ENV AURORA_DIR=/vendor/aurora
ENV WORK_DIR=/work
ENV PUBLIC_OUT=/app/public/wasm
ENV TRANSLATOR_DLL=/vendor/wiicompiled/translator/src/Translator.Cli/bin/Release/net8.0/Translator.Cli.dll
EXPOSE 8787 8788
CMD ["sh", "-c", "node server/net-bridge.mjs & node server/translate-server.mjs"]