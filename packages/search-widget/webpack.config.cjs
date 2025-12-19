const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    mode: 'production',
    entry: './src/components/search.tsx',

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'search.bundle.js',
        library: {
            type: 'module',
        },
        clean: true,
    },

    experiments: {
        outputModule: true,
    },

    externalsType: 'module',

    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        extensionAlias: {
            '.js': ['.js', '.ts', '.tsx'],
            '.mjs': ['.mjs', '.mts'],
        },
        alias: {
            '@': path.resolve(__dirname, 'src'),
            'process/browser': require.resolve('process/browser.js'),
        },
        fullySpecified: false,
    },

    externals: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',

        function ({ request }, callback) {
            if (/^@fern-api\//.test(request) && !/^@fern-api\/(docs-server|docs-utils|ui-core-utils)/.test(request)) {
                return callback(null, 'module ' + request);
            }
            if (/^@fern-docs\/search-server/.test(request)) {
                return callback(null, 'module ' + request);
            }
            callback();
        },
    ],

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        configFile: 'tsconfig.webpack.json',
                    },
                },
                exclude: /node_modules/,
            },
            {
                test: /\.scss$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    'postcss-loader',
                    'sass-loader',
                ],
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    'postcss-loader',
                ],
            },
        ],
    },

    plugins: [
        new MiniCssExtractPlugin({
            filename: 'search.css',
        }),

        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),

        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
            'process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS': JSON.stringify(undefined),
            'process.env.NEXT_RUNTIME': JSON.stringify(undefined),
            'process.env.NEXT_DEPLOYMENT_ID': JSON.stringify(undefined),
            'process.env.NEXT_PUBLIC_IS_LOCAL': JSON.stringify(undefined),
            'process.env.NEXT_PUBLIC_FONTAWESOME_CDN_HOST': JSON.stringify(undefined),
            'process.env.__NEXT_CACHE_COMPONENTS': JSON.stringify(undefined),
            'process.env.VSCODE_TEXTMATE_DEBUG': JSON.stringify(undefined),
        }),

        new webpack.NormalModuleReplacementPlugin(
            /search\/useSearchBox$/,
            path.resolve(__dirname, './src/hooks/useSearchBox.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
            /hooks\/use-search-hits$/,
            path.resolve(__dirname, './src/hooks/useSearchHits.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
            /^@fern-api\/docs-server$/,
            path.resolve(__dirname, './src/stubs/docs-server.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
            /^@fern-api\/docs-utils$/,
            path.resolve(__dirname, './src/stubs/docs-utils.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
            /^@fern-api\/ui-core-utils$/,
            path.resolve(__dirname, './src/stubs/ui-core-utils.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
            /^@fern-api\/ui-core-utils\/identity$/,
            path.resolve(__dirname, './src/stubs/ui-core-utils-identity.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
            /^@fern-docs\/search-keyword\/types$/,
            path.resolve(__dirname, './src/stubs/search-keyword-types.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
            /^@fern-docs\/search-keyword$/,
            path.resolve(__dirname, './src/stubs/search-keyword.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
            /^@fern-docs\/mdx$/,
            path.resolve(__dirname, './src/stubs/fern-docs-mdx.ts')
        ),
        // Replace shiki with shiki/bundle/web for browser compatibility
        new webpack.NormalModuleReplacementPlugin(
            /^shiki$/,
            path.resolve(__dirname, './src/stubs/shiki.ts')
        ),

        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
        }),
    ],

    devtool: false, 
};
