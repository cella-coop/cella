//! Runs rules.toml's CEL rules over the Lanterne facts with the cel crate.
use cel::objects::Value as Cel;
use cel::{Context, Program};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::fs::read_to_string;
use std::sync::Arc;

type Rules = BTreeMap<String, BTreeMap<String, String>>;

fn sum(cel::extractors::Arguments(args): cel::extractors::Arguments) -> i64 {
    match &args[0] {
        Cel::List(xs) => xs.iter().map(|x| if let Cel::Int(i) = x { *i } else { 0 }).sum(),
        _ => 0,
    }
}

// JSON numbers become CEL ints: serde would make non-negative ones uints,
// and CEL refuses to add an int to a uint.
fn to_cel(v: &Value) -> Cel {
    match v {
        Value::Null => Cel::Null,
        Value::Bool(b) => Cel::Bool(*b),
        Value::Number(n) => Cel::Int(n.as_i64().unwrap()),
        Value::String(s) => Cel::String(Arc::new(s.clone())),
        Value::Array(xs) => Cel::List(Arc::new(xs.iter().map(to_cel).collect())),
        Value::Object(m) => Cel::from(m.iter().map(|(k, v)| (k.clone(), to_cel(v))).collect::<std::collections::HashMap<String, Cel>>()),
    }
}

fn eval(rules: &Rules, group: &str, name: &str, vars: &[(&str, &Value)]) -> Value {
    let program = Program::compile(&rules[group][name]).expect(name);
    let mut ctx = Context::default();
    ctx.add_function("sum", sum).unwrap();
    for (k, v) in vars {
        ctx.add_variable(*k, to_cel(v)).unwrap();
    }
    program.execute(&ctx).expect(name).json().expect(name)
}

fn strings(v: &Value) -> Vec<String> {
    let mut xs: Vec<String> = v.as_array().unwrap().iter().map(|x| x.as_str().unwrap().to_string()).collect();
    xs.sort();
    xs
}

fn main() {
    let here = env!("CARGO_MANIFEST_DIR");
    let rules: Rules = toml::from_str(&read_to_string(format!("{here}/rules.toml")).unwrap()).unwrap();
    let facts: Value = serde_json::from_str(&read_to_string(format!("{here}/../facts/lanterne.json")).unwrap()).unwrap();
    let cases: Value = serde_json::from_str(&read_to_string(format!("{here}/../facts/cases.json")).unwrap()).unwrap();
    let f = |k: &str| &facts[k];
    let mut out = vec![];

    for r in cases["requests"].as_array().unwrap() {
        // the host fills absent fields so every rule sees the same shape
        let request = json!({
            "member": r["member"], "action": r["action"], "at": r["at"],
            "amount": r.get("amount").cloned().unwrap_or(json!(0)),
            "circle": r.get("circle").cloned().unwrap_or(json!("")),
            "decision": r.get("decision").cloned().unwrap_or(json!("")),
        });
        let ok = eval(&rules, "permission", "allowed", &[
            ("request", &request), ("positions", f("positions")),
            ("mandates", f("mandates")), ("decisions", f("decisions")),
        ]);
        out.push(format!("request {} {}", r["id"].as_str().unwrap(), if ok == json!(true) { "allow" } else { "deny" }));
    }

    let verdict = |v: Value| {
        let xs = strings(&v);
        if xs.is_empty() { "ok".to_string() } else { format!("refused {}", xs.join(",")) }
    };
    for w in cases["writes"].as_array().unwrap() {
        let v = if w["kind"] == "entry" {
            eval(&rules, "invariant", "entry_faults", &[("entry", w), ("periods", f("periods"))])
        } else {
            let inv = f("invoices").as_array().unwrap().iter().find(|i| i["id"] == w["invoice"]).unwrap();
            eval(&rules, "invariant", "payment_faults", &[("invoice", inv), ("amount", &w["amount"])])
        };
        out.push(format!("write {} {}", w["id"].as_str().unwrap(), verdict(v)));
    }

    // the existing books, checked as they stand
    let listed = |ids: Vec<&str>| if ids.is_empty() { "ok".to_string() } else { ids.join(",") };
    let open_periods = json!(f("periods").as_array().unwrap().iter()
        .map(|p| json!({"month": p["month"], "closed": null})).collect::<Vec<_>>());
    let unbalanced: Vec<&str> = f("entries").as_array().unwrap().iter()
        .filter(|e| !strings(&eval(&rules, "invariant", "entry_faults", &[("entry", e), ("periods", &open_periods)])).is_empty())
        .map(|e| e["id"].as_str().unwrap()).collect();
    let mut overpaid = vec![];
    let mut void_paid = vec![];
    for i in f("invoices").as_array().unwrap() {
        let faults = strings(&eval(&rules, "invariant", "payment_faults", &[("invoice", i), ("amount", &json!(0))]));
        if faults.contains(&"overpaid".to_string()) {
            overpaid.push(i["id"].as_str().unwrap());
        }
        if faults.contains(&"voided".to_string()) && !i["payments"].as_array().unwrap().is_empty() {
            void_paid.push(i["id"].as_str().unwrap());
        }
    }
    out.push(format!("check balance {}", listed(unbalanced)));
    out.push(format!("check overpaid {}", listed(overpaid)));
    out.push(format!("check voided {}", listed(void_paid)));

    for d in f("decisions").as_array().unwrap() {
        let counted = eval(&rules, "procedure", "counted", &[("decision", d), ("positions", f("positions"))]);
        let passes = eval(&rules, "procedure", "passes", &[("decision", d), ("counted", &counted)]);
        let open = eval(&rules, "procedure", "open", &[("decision", d), ("today", f("today"))]);
        out.push(format!(
            "decision {} {} {}",
            d["id"].as_str().unwrap(),
            if passes == json!(true) { "passes" } else { "fails" },
            if open == json!(true) { "open" } else { "closed" },
        ));
    }
    for s in cases["splits"].as_array().unwrap() {
        let a = eval(&rules, "computation", "surplus", &[("split", s)]);
        let v = strings(&a["violations"]);
        let tail = if v.is_empty() { "ok".to_string() } else { format!("violations={}", v.join(",")) };
        out.push(format!("split {} work={} reserves={} interest={} {tail}", s["id"].as_str().unwrap(), a["work"], a["reserves"], a["interest"]));
    }
    out.sort();
    println!("{}", out.join("\n"));
}
