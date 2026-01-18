fn main() {
    uniffi::generate_scaffolding("src/zenone.udl").expect("Failed to generate UniFFI scaffolding");
}
