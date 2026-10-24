# MCL for Visual Studio Code

`.mcl`ファイルのSyntax HighlightingとLanguage Server機能を提供するVisual Studio Code拡張です。Language ServerはMCL CLIの`mcl lsp`を起動して利用します。診断、補完、定義への移動、Rename、ドキュメント整形を利用できます。

## インストール

MCL CLIを[最新リリースからインストール](https://github.com/manifest-configuration-language/mcl/releases/latest)し、`mcl`コマンドをPATHから実行できる状態にします。拡張のVSIXは次のコマンドで生成できます。

```sh
pnpm install
pnpm run package
```

生成されるファイルは`mcl-vscode-0.1.0.vsix`です。VS CodeのExtensionsビューのメニューから「Install from VSIX...」を選択してインストールします。

## 設定

| 設定               | 初期値    | 説明                                                                                                                    |
| ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `mcl.server.path`  | `mcl`     | MCL実行ファイルのpath。PATH上の名前または絶対pathを指定します。                                                         |
| `mcl.server.args`  | `["lsp"]` | Language Server起動時に実行ファイルへ渡す引数です。                                                                     |
| `mcl.trace.server` | `off`     | LSP通信ログの出力レベルです。`messages`または`verbose`を指定すると、Outputの`MCL Language Server` channelに記録します。 |

CLIをPATH以外の場所に配置した場合は、ワークスペース設定で実行ファイルを指定します。複数folderのworkspaceでは`${workspaceFolder}`を使わず、PATH名または絶対pathを指定してください。

```json
{
  "mcl.server.path": "${workspaceFolder}/bin/mcl",
  "mcl.server.args": ["lsp"]
}
```

`mcl.server.path`のPATH名はPATHから検索し、絶対pathはそのまま使います。相対pathはworkspace folderが1つの場合にそのfolderを基準に解決し、workspace folderが0個または複数の場合はVS Code Extension Hostの作業ディレクトリを基準にします。`${workspaceFolder}`はfolderが1つの場合だけ使用できます。Language Serverは1つ起動し、MCL Language Serverが複数のworkspace folderを処理します。

Windowsでは`mcl.server.path`に`mcl.exe`のpathを設定します。

## Commands

- `MCL: Restart Language Server`はLanguage Serverを再起動します。
- `MCL: Show Language Server Output`はLanguage Serverのログを表示します。

## 開発

`mise install`で`mise.toml`が指定するMCL CLIを含む開発ツールをインストールしてから、`pnpm run test:integration`を実行します。統合テストはPATH上の`mcl`コマンドを起動し、診断と整形を確認します。

```sh
mise install
pnpm install
pnpm run compile
pnpm run lint
pnpm run format:check
pnpm run test
pnpm run test:integration
pnpm run package
```
