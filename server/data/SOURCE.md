# Weshah Egypt address data, CAPMAS 2023

This package contains a usable Arabic dependent-dropdown directory extracted from the official CAPMAS Administrative Units Directory, January 2023. Source decisions are dated through 31 December 2022. Compilation and QA: 22 November 2026.

## Contents
- `egypt-addresses-capmas-2023.json`: one compact file containing `meta`, 27 `governorates`, 393 `centers`, and 6,519 `localities`.
- `chunks/governorates.json`: small initial governorate list.
- `chunks/01.json` through the actual governorate codes: 27 independent chunks, each with that governorate's parents and localities. The codes intentionally have gaps.
- `coverage.json`: per-governorate counts, source/version/caveats and excluded duplicate appendix references.
- `validation.json`: structural checks, checksum and the two duplicate-name groups.
- `pixel-review-overrides.json`: explicit primary-label and urban/rural corrections grounded in inspected source pixels.
- `qa/`: inspected source comparison sheets and decisive source images.
- `source-audit/`: candidate extraction for audit, not intended to be served to customers. The released root JSON and chunks are the integration assets.

## Integration
Preserve codes as strings, including leading zeros. Use `meta.id` as the dataset version. The original CAPMAS codes are not interchangeable with the older HDX hierarchy even when some numbers resemble one another.

For the governorate choice use `governorates[].code`. Filter `centers` by `governorate_code`. Filter `localities` by both `parent_code` and `governorate_code`. `centers[].code` is the `localities[].parent_code`.

Show `display_name_ar` when present, otherwise `name_ar`. Two names appear under different official codes within the same parent: الأحرار in 3406, and وادى المقرح in 3505. The source pixels confirm the duplicate names. They were not merged; `display_name_ar` adds their code for disambiguation. Users unable to tell them apart should use the custom-area route, not be forced to guess.

Suggested labels:
- المحافظة
- المركز / القسم / المدينة
- القرية / الحي / المنطقة
- منطقتي غير موجودة في القائمة
- العنوان التفصيلي

When the governorate changes, clear both lower selections. When the parent changes, clear the locality. Revalidate the code relationships on the server. A known locality must belong to the selected parent and governorate.

The explicit custom-area route is part of the contract, not optional polish. Keep the known governorate code and separately store the user's actual unlisted center/locality names and detailed address, marked custom/unverified. Do not create an official code, assign a nearest center, or auto-publish customer-entered text into the shared directory. A missing place must not prevent registration. Details such as street, building, floor/apartment and landmark remain separate.

Store the source version, selected codes and name snapshots with saved addresses/orders. Later directory corrections must not silently rewrite old order addresses. Shipping eligibility and price are separate merchant rules, not facts implied by this list.

## What was checked
- 6,523 six-digit code occurrences were recovered from the PDF tables and appendix. Four appendix references duplicate real table records and were excluded. Final unique locality codes: 6,519.
- 393 unique printed four-digit parents with coded child rows and all 27 governorate prefixes.
- No duplicate codes, orphan parents, blank Arabic labels or mismatched code prefixes in the released asset.
- All recorded urban/rural values are source flags 1 or 2. Those flags do not by themselves identify an entity as a village, neighborhood or notional unit.
- 61 locality source-row samples were visually inspected, covering every governorate and the extraction anomalies then detected. A separate 27-parent sample, one per governorate, and all four rows in the duplicate-name groups were also inspected.
- Two six-digit codes, 120916 and 280901, were initially merged with neighboring punctuation by PDF word extraction. Both were recovered from individual glyph coordinates and checked against the source pixels.
- Some fonts emit a zero-width alef before lam even though the rendered glyph is lam-alef. The parser repairs only that measurable glyph case. It does not substitute place names from memory.
- Wrapped descriptions, section-heading leakage and malformed parenthetical aliases were reviewed. Fifteen locality primary labels and fourteen urban/rural flags have explicit pixel-review overrides. Eighteen long descriptions are shortened to their primary selection label; the audit candidate preserves the source extraction.
- The primary CAPMAS attribution notice and January 2023 cover were visually checked. The Esna/Armant centers are correctly under Luxor in this asset, unlike the stale HDX base.

## Coverage limits
This is a dated source extraction, not a certification of every current address. No claim of complete November 2026 village coverage is supported. Changes after 31 December 2022 remain unverified. The third level mixes villages, cities, shiyakhas and notional populated units. Hamlets, informal areas, delivery landmarks and every new urban community are not guaranteed separately listed. Four-digit units without coded locality rows are not established as covered by this extraction. The directory's various administrative summary categories overlap or differ from the model here; no claim that this record count equals a universal official village count is made.

Every record was machine-checked for structure. Not every place name was individually field-verified or every source row manually read. Some source spelling or administrative status may need later correction. Keep the dated provenance visible in administration and retain the custom-area route.

## Source and reuse notice
Official PDF:
https://www.capmas.gov.eg:8080/Publication/Pdf/f6952a1c-fcb5-41a9-8246-07bf860d9fd5.pdf

The source PDF says publication or quotation requires identifying CAPMAS as the source. It does not state a standard MIT or Creative Commons license. Do not relabel the data with either. Preserve the attribution and source/version link, and state that the material was reformatted and some descriptions shortened. Broader terms beyond the PDF's attribution notice were not established in this work.

Suggested attribution:
المصدر: الجهاز المركزي للتعبئة العامة والإحصاء، دليل الوحدات الإدارية لمحافظات الجمهورية، يناير 2023. أعيد تنسيق البيانات واختصار بعض الأوصاف للقوائم.

No repository, account, deployment or production data was modified during compilation. This package contains public administrative source data, not customer information.
