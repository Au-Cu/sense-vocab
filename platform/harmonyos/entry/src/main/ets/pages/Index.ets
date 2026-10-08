@Entry
@Component
struct Index {
  build() {
    Column({ space: 16 }) {
      Text('Sense Vocab').fontSize(28).fontWeight(FontWeight.Bold)
      Text('Native HarmonyOS entry; offline resource and storage adapters are validated by the host build.')
        .fontSize(16)
        .fontColor(Color.Gray)
    }.width('100%').height('100%').justifyContent(FlexAlign.Center).padding(24)
  }
}
