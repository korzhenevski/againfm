describe_recipe 'elasticsearch::default' do

  include MiniTest::Chef::Assertions
  include MiniTest::Chef::Context
  include MiniTest::Chef::Resources

  describe "Installation" do

    it "installs libraries to versioned directory" do
      version = node[:elasticsearch][:version]

      directory("/usr/local/elasticsearch-#{node[:elasticsearch][:version]}").
        must_exist.
        with(:owner, 'elasticsearch')
    end

    it "installs elasticsearch jar" do
      version = node[:elasticsearch][:version]

      file("/usr/local/elasticsearch-#{version}/lib/elasticsearch-#{version}.jar").
        must_exist.
        with(:owner, 'elasticsearch')
    end unless Chef::VERSION > '0.10.8' # TODO: Unbrake this when Chef gets sane with symlinks again

    it "has a link to versioned directory" do
      version = node[:elasticsearch][:version]

      link("/usr/local/elasticsearch").
        must_exist.
        with(:link_type, :symbolic).
        and(:to, "/usr/local/elasticsearch-#{version}")
    end

    it "creates configuration files" do
      file("/usr/local/etc/elasticsearch/elasticsearch.yml").
        must_exist.
        must_include("cluster.name: 'elasticsearch_vagrant'").
        must_include("path.data: /usr/local/var/data/elasticsearch")

      file("/usr/local/etc/elasticsearch/elasticsearch-env.sh").
        must_exist.
        must_include("ES_HOME='/usr/local/elasticsearch'")
    end

  end

end
