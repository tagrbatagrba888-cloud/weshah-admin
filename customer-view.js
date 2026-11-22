export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function customerRows(customers, orders = null) {
  const groups = new Map();
  for (const order of orders || []) {
    if (typeof order.uid !== "string" || !order.uid) continue;
    const list = groups.get(order.uid) || [];
    list.push(order);
    groups.set(order.uid, list);
  }
  return customers.map((c) => {
    const mismatch = !!c.uid && c.uid !== c.id;
    return {
      ...c,
      associationError: mismatch,
      ownOrders: orders === null || mismatch ? null : groups.get(c.id) || [],
    };
  });
}
export function searchCustomers(rows, q) {
  q = String(q).trim().toLocaleLowerCase("ar");
  return rows.filter((c) =>
    [c.name, c.username, c.phone, c.email, c.id].some((x) =>
      String(x ?? "")
        .toLocaleLowerCase("ar")
        .includes(q),
    ),
  );
}
export function customerTable(rows) {
  return `<div class="table-scroll"><table><thead><tr><th>العميل</th><th>التواصل</th><th>العنوان</th><th>الطلبات المقروءة</th><th></th></tr></thead><tbody>${rows.map((c) => `<tr><td data-label="العميل"><strong>${esc(c.name) || "اسم غير مسجل"}</strong><small>${esc(c.username)}</small></td><td data-label="التواصل"><bdi>${esc(c.phone)}</bdi><small><bdi>${esc(c.email)}</bdi></small></td><td data-label="العنوان">${esc([c.city, c.address].filter(Boolean).join("، ")) || "غير مسجل"}</td><td data-label="الطلبات المقروءة">${c.associationError ? "معرّف غير متطابق" : c.ownOrders === null ? "تعذّرت القراءة" : c.ownOrders.length}</td><td data-label="التفاصيل"><button class="btn btn-soft" type="button" data-customer="${esc(c.id)}">التفاصيل</button></td></tr>`).join("") || '<tr><td colspan="5">لا توجد نتائج مطابقة.</td></tr>'}</tbody></table></div>`;
}
export function customerDetails(c) {
  return `<dl>${[
    ["اسم العميل", c.name],
    ["اسم المستخدم", c.username],
    ["الهاتف", c.phone],
    ["البريد", c.email],
    ["المدينة", c.city],
    ["العنوان", c.address],
    ["معرّف السجل", c.id],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v) || "غير مسجل"}</dd></div>`)
    .join(
      "",
    )}</dl><h3>طلبات مرتبطة بمعرّف الحساب فقط</h3>${c.ownOrders === null ? "<p>لا يمكن عرض الطلبات الآن. لم نربطها بالاسم أو الهاتف.</p>" : c.ownOrders.length ? `<ul class="customer-orders">${c.ownOrders.map((o) => `<li><bdi>${esc(o.orderNumber) || esc(o.id)}</bdi> <span>${esc({ pending: "قيد الانتظار", processing: "قيد التجهيز", shipped: "تم الشحن", completed: "تم التسليم", cancelled: "ملغي", refunded: "مرتجع" }[o.status] || "حالة غير مسجلة")}</span></li>`).join("")}</ul>` : "<p>لا توجد طلبات مرتبطة في القراءة الحالية.</p>"}<p class="muted">عرض للقراءة فقط. لا تعديل أو حذف لبيانات العميل من هذه الصفحة.</p>`;
}
