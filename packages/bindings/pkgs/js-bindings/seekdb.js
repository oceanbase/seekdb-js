const getRuntimePlatformArch = () => `${process.platform}-${process.arch}`;

/**
 * @throw Error if there isn't any available native binding for the current platform/arch.
 */
const getNativeNodeBinding = (runtimePlatformArch) => {
    switch (runtimePlatformArch) {
        case `linux-x64`:
            return require('@seekdb/js-bindings-linux-x64/seekdb.node');
        case 'linux-arm64':
            return require('@seekdb/js-bindings-linux-arm64/seekdb.node');
        case 'darwin-arm64':
            return require('@seekdb/js-bindings-darwin-arm64/seekdb.node');
        case 'darwin-x64':
            return require('@seekdb/js-bindings-darwin-x64/seekdb.node');
        default:
            const [platform, arch] = runtimePlatformArch.split('-');
            try {
                return require(`@seekdb/js-bindings-${platform}-${arch}/seekdb.node`);
            } catch (err) {
                throw new Error(`Error loading seekdb native binding: unsupported arch '${arch}' for platform '${platform}'`);
            }
    }
}

module.exports = getNativeNodeBinding(getRuntimePlatformArch());
