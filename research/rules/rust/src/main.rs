use lanterne_rules::*;
use serde::Deserialize;

#[derive(Deserialize)]
struct Write {
    id: String,
    kind: String,
    date: Option<String>,
    lines: Option<Vec<Line>>,
    invoice: Option<String>,
    amount: Option<i64>,
}

#[derive(Deserialize)]
struct Cases {
    requests: Vec<Req>,
    writes: Vec<Write>,
    splits: Vec<SplitCase>,
}

#[derive(Deserialize)]
struct Req {
    id: String,
    #[serde(flatten)]
    req: Request,
}

#[derive(Deserialize)]
struct SplitCase {
    id: String,
    #[serde(flatten)]
    split: Split,
}

fn verdict(mut faults: Vec<&str>) -> String {
    faults.sort();
    if faults.is_empty() {
        "ok".into()
    } else {
        format!("refused {}", faults.join(","))
    }
}

fn listed(ids: Vec<&str>) -> String {
    if ids.is_empty() { "ok".into() } else { ids.join(",") }
}

fn main() {
    let base = std::env::var("FACTS").unwrap_or(concat!(env!("CARGO_MANIFEST_DIR"), "/../facts/").into());
    let facts: Facts = serde_json::from_str(&std::fs::read_to_string(format!("{base}lanterne.json")).unwrap()).unwrap();
    let cases: Cases = serde_json::from_str(&std::fs::read_to_string(format!("{base}cases.json")).unwrap()).unwrap();
    let mut out = vec![];

    for r in &cases.requests {
        out.push(format!("request {} {}", r.id, if allowed(&facts, &r.req) { "allow" } else { "deny" }));
    }
    for w in cases.writes {
        let faults = if w.kind == "entry" {
            let e = Entry { id: None, date: w.date.unwrap(), lines: w.lines.unwrap() };
            entry_faults(&facts, &e)
        } else {
            let inv = facts.invoices.iter().find(|i| Some(&i.id) == w.invoice.as_ref()).unwrap();
            payment_faults(inv, w.amount.unwrap())
        };
        out.push(format!("write {} {}", w.id, verdict(faults)));
    }

    let unbalanced = facts.entries.iter().filter(|e| entry_faults(&facts, e).contains(&"unbalanced"));
    let overpaid = facts.invoices.iter().filter(|i| i.payments.iter().map(|p| p.amount).sum::<i64>() > i.total);
    let void_paid = facts.invoices.iter().filter(|i| i.voided.is_some() && !i.payments.is_empty());
    out.push(format!("check balance {}", listed(unbalanced.map(|e| e.id.as_deref().unwrap()).collect())));
    out.push(format!("check overpaid {}", listed(overpaid.map(|i| i.id.as_str()).collect())));
    out.push(format!("check voided {}", listed(void_paid.map(|i| i.id.as_str()).collect())));

    for d in &facts.decisions {
        let o = outcome(&facts, d);
        out.push(format!(
            "decision {} {} {}",
            d.id,
            if o.passes { "passes" } else { "fails" },
            if o.open { "open" } else { "closed" }
        ));
    }
    for s in &cases.splits {
        let a = split(&s.split);
        let mut v = a.violations.clone();
        v.sort();
        let tail = if v.is_empty() { "ok".into() } else { format!("violations={}", v.join(",")) };
        out.push(format!("split {} work={} reserves={} interest={} {tail}", s.id, a.work, a.reserves, a.interest));
    }
    out.sort();
    println!("{}", out.join("\n"));
}
