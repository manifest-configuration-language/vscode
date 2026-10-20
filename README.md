# MCL for Visual Studio Code

`.mcl`ファイルのSyntax HighlightingとLanguage Server機能を提供するVisual Studio Code拡張です。Language ServerはMCL CLIの`mcl lsp`を起動して利用します。診断、補完、定義への移動、Rename、ドキュメント整形を利用できます。

## インストール

MCL CLIを[インストール](https://github.com/manifest-configuration-language/mcl)し、`mcl`コマンドをPATHから実行できる状態にします。拡張のVSIXは次のコマンドで生成できます。

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

CLIをPATH以外の場所に配置した場合は、ワークスペース設定で実行ファイルを指定します。

```json
{
  "mcl.server.path": "${workspaceFolder}/bin/mcl",
  "mcl.server.args": ["lsp"]
}
```

`mcl.server.path`のPATH名はPATHから検索し、絶対pathはそのまま使います。相対pathと`${workspaceFolder}`は先頭のworkspace folderを基準に解決します。複数folderを開いている場合もLanguage Serverは1つだけ起動し、先頭folderの設定と作業ディレクトリを使います。workspace folderがない場合、相対pathはVS Code Extension Hostの作業ディレクトリを基準にします。`${workspaceFolder}`を指定した状態でworkspace folderがない場合は起動エラーを表示します。

Windowsでは`mcl.server.path`に`mcl.exe`のpathを設定します。

## Commands

- `MCL: Restart Language Server`はLanguage Serverを再起動します。
- `MCL: Show Language Server Output`はLanguage Serverのログを表示します。

## 開発

```sh
pnpm install
pnpm run compile
pnpm run lint
pnpm run format:check
pnpm run package
```
