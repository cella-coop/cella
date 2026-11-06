//! A document's canonical form: the block tree a Loro document holds,
//! written as JSON per RFC 8785 (JCS), so that a version is named by the
//! BLAKE3 of these bytes and anyone holding its Loro snapshot can compute
//! the name again without cella.
//!
//! The form is `{"blocks":[…],"v":1}`. Each block, in reading order, is an
//! object with its `type`, the props its type keeps, its text as `runs`
//! (each a `text` with the `marks` on it) and its `children`. Block ids are
//! Loro's and are left out, so two documents that read the same hash the
//! same however they were made. An empty `runs` or `children` is left out,
//! so absence has one spelling; equal neighbouring runs are joined. A
//! number is an integer, within JavaScript's safe range; anything else in
//! a prop or a mark refuses the document, as the TypeScript canonicaliser
//! in the document feat does.

use crate::{Error, Result};
use loro::{
    Container, LoroDoc, LoroMap, LoroTree, LoroValue, TextDelta, TreeID, TreeParentId,
    ValueOrContainer,
};
use std::fmt::Write;

/// The tree every document keeps its blocks in.
pub const TREE: &str = "blocks";

/// The marks a run may carry, the only attributes the form keeps.
pub const MARKS: [&str; 4] = ["bold", "italic", "code", "link"];

/// The props each type of block keeps, and whether it is atomic: an
/// atomic block holds no text in the form.
const TYPES: [(&str, &[&str], bool); 9] = [
    ("paragraph", &[], false),
    ("heading", &["level"], false),
    ("bullet", &[], false),
    ("numbered", &[], false),
    ("todo", &["checked"], false),
    ("quote", &[], false),
    ("code", &["language"], false),
    ("divider", &[], true),
    ("embed", &["embed", "ref"], true),
];

const SAFE: i64 = (1 << 53) - 1;

fn refuse(why: impl Into<String>) -> Error {
    Error::Document(why.into())
}

/// A Loro document from a snapshot or updates, refused if it depends on
/// operations it does not hold.
pub fn load(bytes: &[u8]) -> Result<LoroDoc> {
    let doc = LoroDoc::new();
    let status = doc
        .import(bytes)
        .map_err(|e| refuse(format!("not a Loro document: {e}")))?;
    if status.pending.is_some() {
        return Err(refuse("the document depends on updates it does not hold"));
    }
    Ok(doc)
}

/// The canonical JSON of a document's blocks, from a snapshot or updates.
pub fn canonical(bytes: &[u8]) -> Result<String> {
    let doc = load(bytes)?;
    let tree = doc.get_tree(TREE);
    let mut out = String::from("{\"blocks\":[");
    for (i, id) in children(&tree, TreeParentId::Root).into_iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        block(&tree, id, &mut out)?;
    }
    out.push_str("],\"v\":1}");
    Ok(out)
}

/// The plain BLAKE3 of the canonical JSON, as `b3sum` computes it: the
/// name of a document version.
pub fn hash(bytes: &[u8]) -> Result<[u8; 32]> {
    Ok(crate::digest(canonical(bytes)?.as_bytes()))
}

/// The document's text as a reader sees it: each text block's text in
/// reading order, one line each, for quoting and search.
pub fn plain(bytes: &[u8]) -> Result<String> {
    let doc = load(bytes)?;
    let tree = doc.get_tree(TREE);
    let mut lines = Vec::new();
    let mut stack: Vec<TreeID> = children(&tree, TreeParentId::Root)
        .into_iter()
        .rev()
        .collect();
    while let Some(id) = stack.pop() {
        let meta = meta(&tree, id)?;
        let (_, _, atomic) = kind(&meta)?;
        if !atomic {
            lines.push(runs(&meta)?.into_iter().map(|(t, _)| t).collect::<String>());
        }
        stack.extend(children(&tree, TreeParentId::Node(id)).into_iter().rev());
    }
    Ok(lines.join("\n"))
}

fn children(tree: &LoroTree, parent: TreeParentId) -> Vec<TreeID> {
    tree.children(parent).unwrap_or_default()
}

fn meta(tree: &LoroTree, id: TreeID) -> Result<LoroMap> {
    tree.get_meta(id)
        .map_err(|e| refuse(format!("block {id} has no data: {e}")))
}

// A block's type, its props and whether it is atomic; a block that names
// no type is a paragraph.
fn kind(meta: &LoroMap) -> Result<(&'static str, &'static [&'static str], bool)> {
    let name = match meta.get("type") {
        None => "paragraph".to_owned(),
        Some(ValueOrContainer::Value(LoroValue::String(s))) => s.to_string(),
        Some(_) => return Err(refuse("a block's type is not a string")),
    };
    TYPES
        .iter()
        .find(|(t, _, _)| *t == name)
        .copied()
        .ok_or_else(|| refuse(format!("unknown block type {name:?}")))
}

fn block(tree: &LoroTree, id: TreeID, out: &mut String) -> Result<()> {
    let meta = meta(tree, id)?;
    let (name, props, atomic) = kind(&meta)?;
    let runs = if atomic { Vec::new() } else { runs(&meta)? };
    let kids = children(tree, TreeParentId::Node(id));

    // Keys in JCS order: they are ASCII, so byte order is UTF-16 order.
    let mut fields: Vec<(&str, String)> = Vec::new();
    for key in props {
        match meta.get(key) {
            None => {}
            Some(ValueOrContainer::Value(v)) => fields.push((key, value(&v)?)),
            Some(ValueOrContainer::Container(_)) => {
                return Err(refuse(format!("prop {key} is a container")));
            }
        }
    }
    fields.push(("type", string(name)));
    if !runs.is_empty() {
        let mut s = String::from("[");
        for (i, (text, marks)) in runs.iter().enumerate() {
            if i > 0 {
                s.push(',');
            }
            if marks.is_empty() {
                let _ = write!(s, "{{\"text\":{}}}", string(text));
            } else {
                let mut sorted = marks.clone();
                sorted.sort_by(|a, b| a.0.cmp(b.0));
                let m: Vec<String> = sorted
                    .iter()
                    .map(|(k, v)| format!("{}:{v}", string(k)))
                    .collect();
                let _ = write!(
                    s,
                    "{{\"marks\":{{{}}},\"text\":{}}}",
                    m.join(","),
                    string(text)
                );
            }
        }
        s.push(']');
        fields.push(("runs", s));
    }
    if !kids.is_empty() {
        let mut s = String::from("[");
        for (i, kid) in kids.into_iter().enumerate() {
            if i > 0 {
                s.push(',');
            }
            block(tree, kid, &mut s)?;
        }
        s.push(']');
        fields.push(("children", s));
    }
    fields.sort_by(|a, b| a.0.cmp(b.0));
    out.push('{');
    for (i, (k, v)) in fields.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        let _ = write!(out, "{}:{v}", string(k));
    }
    out.push('}');
    Ok(())
}

type Run = (String, Vec<(&'static str, String)>);

// A block's text as runs: each insert with the marks on it that are set,
// a false or null mark being unset, and equal neighbours joined.
fn runs(meta: &LoroMap) -> Result<Vec<Run>> {
    let Some(ValueOrContainer::Container(Container::Text(text))) = meta.get("text") else {
        return Err(refuse("a block holds no text"));
    };
    let mut out: Vec<Run> = Vec::new();
    for d in text.to_delta() {
        let TextDelta::Insert { insert, attributes } = d else {
            continue;
        };
        let mut marks = Vec::new();
        for key in MARKS {
            match attributes.as_ref().and_then(|a| a.get(key)) {
                None | Some(LoroValue::Null | LoroValue::Bool(false)) => {}
                Some(v) => marks.push((key, value(v)?)),
            }
        }
        match out.last_mut() {
            Some(last) if last.1 == marks => last.0.push_str(&insert),
            _ => out.push((insert, marks)),
        }
    }
    out.retain(|(t, _)| !t.is_empty());
    Ok(out)
}

// A prop's or a mark's value in JCS: null, a boolean, an integer in the
// safe range or a string.
fn value(v: &LoroValue) -> Result<String> {
    match v {
        LoroValue::Null => Ok("null".into()),
        LoroValue::Bool(b) => Ok(b.to_string()),
        LoroValue::I64(n) if (-SAFE..=SAFE).contains(n) => Ok(n.to_string()),
        LoroValue::String(s) => Ok(string(s)),
        LoroValue::I64(_) => Err(refuse("a number beyond the safe integers")),
        LoroValue::Double(_) => Err(refuse("a number that is not an integer")),
        _ => Err(refuse(
            "a value that is not null, a boolean, an integer or a string",
        )),
    }
}

// A JSON string as ECMAScript's JSON.stringify writes it, which JCS
// prescribes: quotes and backslashes escaped, the control characters as
// their short escapes or `\u00xx`, everything else as is.
fn string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use loro::LoroText;

    fn doc() -> LoroDoc {
        let doc = LoroDoc::new();
        doc.set_peer_id(1).unwrap();
        doc
    }

    fn node(doc: &LoroDoc, parent: TreeParentId, kind: &str, text: &str) -> TreeID {
        let tree = doc.get_tree(TREE);
        tree.enable_fractional_index(0);
        let id = tree.create(parent).unwrap();
        let meta = tree.get_meta(id).unwrap();
        meta.insert("type", kind).unwrap();
        let t = meta.insert_container("text", LoroText::new()).unwrap();
        t.insert(0, text).unwrap();
        id
    }

    fn snapshot(doc: &LoroDoc) -> Vec<u8> {
        doc.commit();
        doc.export(loro::ExportMode::Snapshot).unwrap()
    }

    #[test]
    fn writes_blocks_in_order_with_sorted_keys() {
        let d = doc();
        let h = node(&d, TreeParentId::Root, "heading", "Rate card");
        d.get_tree(TREE)
            .get_meta(h)
            .unwrap()
            .insert("level", 1)
            .unwrap();
        let b = node(&d, TreeParentId::Root, "bullet", "Day \"rate\"");
        node(&d, TreeParentId::Node(b), "paragraph", "560 €\n");
        node(&d, TreeParentId::Root, "divider", "ignored");
        assert_eq!(
            canonical(&snapshot(&d)).unwrap(),
            r#"{"blocks":[{"level":1,"runs":[{"text":"Rate card"}],"type":"heading"},{"children":[{"runs":[{"text":"560 €\n"}],"type":"paragraph"}],"runs":[{"text":"Day \"rate\""}],"type":"bullet"},{"type":"divider"}],"v":1}"#
        );
        assert_eq!(
            plain(&snapshot(&d)).unwrap(),
            "Rate card\nDay \"rate\"\n560 €\n"
        );
    }

    #[test]
    fn marks_are_sorted_and_unset_marks_dropped() {
        let d = doc();
        let p = node(&d, TreeParentId::Root, "paragraph", "ab");
        let Some(ValueOrContainer::Container(Container::Text(t))) =
            d.get_tree(TREE).get_meta(p).unwrap().get("text")
        else {
            panic!("no text")
        };
        t.mark(0..2, "link", "https://x").unwrap();
        t.mark(0..1, "bold", true).unwrap();
        t.mark(0..2, "italic", true).unwrap();
        t.unmark(0..2, "italic").unwrap();
        assert_eq!(
            canonical(&snapshot(&d)).unwrap(),
            r#"{"blocks":[{"runs":[{"marks":{"bold":true,"link":"https://x"},"text":"a"},{"marks":{"link":"https://x"},"text":"b"}],"type":"paragraph"}],"v":1}"#
        );
    }

    #[test]
    fn refuses_what_has_no_spelling() {
        let d = doc();
        let h = node(&d, TreeParentId::Root, "heading", "x");
        d.get_tree(TREE)
            .get_meta(h)
            .unwrap()
            .insert("level", 1.5)
            .unwrap();
        assert!(canonical(&snapshot(&d)).is_err());
        let d = doc();
        node(&d, TreeParentId::Root, "table", "x");
        assert!(canonical(&snapshot(&d)).is_err());
        assert!(canonical(&[1, 2, 3]).is_err());
    }

    #[test]
    fn an_empty_document_and_its_hash() {
        let d = doc();
        let bytes = snapshot(&d);
        assert_eq!(canonical(&bytes).unwrap(), r#"{"blocks":[],"v":1}"#);
        assert_eq!(
            hash(&bytes).unwrap(),
            crate::digest(br#"{"blocks":[],"v":1}"#)
        );
    }

    #[test]
    fn strings_escape_as_json_stringify_does() {
        assert_eq!(
            string("a\u{1}\u{7f}\u{2028}é\t"),
            "\"a\\u0001\u{7f}\u{2028}é\\t\""
        );
    }
}
