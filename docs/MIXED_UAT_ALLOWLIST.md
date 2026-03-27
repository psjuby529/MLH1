# Mixed 匯入 — 明早 UAT 允許清單（limited）

本清單依批次驗收結果：僅 **通過** mixed 匯入（`conflict_count = 0` 且 `suspect_count = 0`）的卷別可納入明早測試；**不**再改 mixed parser、**不**處理綜合 A/B。

## 【允許測試】

對應 `raw_pdfs_mixed/` 內已通過之 PDF／題庫（工程管理學科 105–113、共同科目 90006–90009）：

- 105  
- 106  
- 107  
- 108  
- 109  
- 110  
- 111  
- 112  
- 113  
- 90006  
- 90007  
- 90008  
- 90009  

（實際 `dataset_id` 可能為 `y105`…`y113`、`c90006`…`c90009` 等，以 `public/data/index.json`／`public/data/multi/index.json` 為準。）

## 【暫不納入明早測試】

- 綜合A（`綜合A.pdf`）  
- 綜合B（`綜合B.pdf`）  

**原因（簡短）：** 綜合卷目前 **conflict 高**，須後續**單獨**處理卷種／分區規則；**不影響**已通過 **13 份**的 mixed 測試與 `verify:data`／`verify:multi` 通過狀態。
